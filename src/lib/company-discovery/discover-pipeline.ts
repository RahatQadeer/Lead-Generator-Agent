import { applyCriteria } from "@/lib/company-discovery/apply-criteria";
import { CompanyDiscoveryError } from "@/lib/company-discovery/errors";
import type { ProviderSearchResult } from "@/lib/company-discovery/types";
import { createLogger } from "@/lib/logger";
import {
  isInvestorOrAcceleratorOrganization,
  isNonCommercialOrganization,
} from "@/lib/scraping/org-type-blockers";
import { cleanCompanyNameFromSearchTitle, isHistoricalOrDefunctName, looksLikePersonName } from "@/lib/scraping/company-search-filter";
import { sanitizeCompanyLinkedInForCompany } from "@/lib/scraping/data-quality";
import { enrichCompanyFromWebsite } from "@/lib/scraping/enrich-company";
import { isLikelyCompanyDomain } from "@/lib/scraping/extract-domain";
import { mapPool } from "@/lib/scraping/parallel-pool";
import type { MergedCompanySeed } from "@/lib/scraping/merge-company-seeds";
import { rankMergedSeedsBySearch, seedLooksForeign } from "@/lib/scraping/rank-search-seeds";
import type { CompanyDiscoveryParams, DiscoveredCompany } from "@/types/company";

const log = createLogger("company-discovery.pipeline");
const ENRICH_CONCURRENCY = 3;

function estimateEmployeeCount(snippet: string): number | null {
  const match = snippet.match(/(\d{1,5})\+?\s*(employees|staff|people)/i);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isFinite(count) ? count : null;
}

function mapSeedToCompany(
  seed: {
    name: string;
    domain: string;
    snippet: string;
    url: string;
    country?: string | null;
    city?: string | null;
    seedSource?: "directory" | "web";
    linkedinUrl?: string | null;
    completenessScore?: number;
    industryHint?: string | null;
    phone?: string | null;
  },
  index: number,
  idPrefix: string
): DiscoveredCompany {
  const fromDirectory = seed.seedSource === "directory";
  const completenessBoost = seed.completenessScore
    ? Math.round((seed.completenessScore - 50) / 5)
    : 0;

  const descriptionParts = [seed.snippet?.trim(), seed.phone?.trim()].filter(Boolean);
  const description = descriptionParts.join(" · ").slice(0, 280) || null;

  return {
    id: `${idPrefix}-${seed.domain}-${index}`,
    name: cleanCompanyNameFromSearchTitle(seed.name, seed.domain),
    domain: seed.domain,
    industry: seed.industryHint?.trim() || null,
    description,
    employeeCount: estimateEmployeeCount(seed.snippet),
    country: seed.country ?? null,
    city: seed.city ?? null,
    state: null,
    linkedinUrl:
      sanitizeCompanyLinkedInForCompany(seed.linkedinUrl ?? null, seed.name, seed.domain) ??
      null,
    websiteUrl: seed.url,
    technologies: null,
    confidenceScore: Math.min(85, (fromDirectory ? 55 : 40) + completenessBoost),
  };
}

/** Enrich, filter, and paginate merged company seeds (shared by scraping + Apify providers). */
export async function finalizeCompanyDiscovery(
  params: CompanyDiscoveryParams,
  mergedSeeds: MergedCompanySeed[],
  options: { idPrefix?: string; emptyLogMessage?: string } = {}
): Promise<ProviderSearchResult> {
  const idPrefix = options.idPrefix ?? "scraping";

  const rankedSeeds = rankMergedSeedsBySearch(mergedSeeds, {
    industry: params.industry,
    country: params.country,
    companySizeMin: params.companySizeMin,
    companySizeMax: params.companySizeMax,
    technologies: params.technologies,
    keywords: params.keywords,
  });

  const seeds = rankedSeeds.filter((result) => {
    if (!result.domain || !isLikelyCompanyDomain(result.domain)) return false;
    if (params.country.trim() && seedLooksForeign(result, params.country)) return false;
    if (looksLikePersonName(result.title) || isHistoricalOrDefunctName(result.title)) {
      return false;
    }
    const orgCheck = isNonCommercialOrganization({
      name: result.title,
      description: result.snippet,
      domain: result.domain,
    });
    if (orgCheck.blocked) return false;

    return !isInvestorOrAcceleratorOrganization({
      name: result.title,
      description: result.snippet,
      domain: result.domain,
    }).blocked;
  });

  if (seeds.length === 0) {
    log.warn(options.emptyLogMessage ?? "No companies found from seeds");
    return {
      companies: [],
      pagination: {
        page: params.page,
        perPage: params.perPage,
        totalEntries: 0,
        totalPages: 1,
        hasMore: false,
      },
      stats: {
        seedCount: 0,
        enrichedCount: 0,
        filteredCount: 0,
      },
    };
  }

  const mapped = seeds.map((seed, index) =>
    mapSeedToCompany(
      {
        name: seed.title,
        domain: seed.domain!,
        snippet: seed.snippet,
        url: seed.url,
        country: seed.country,
        city: seed.city,
        seedSource: seed.seedSource,
        linkedinUrl: seed.socialLinks?.linkedin ?? null,
        completenessScore: seed.completenessScore,
        industryHint: seed.industryHint,
        phone: seed.phone,
      },
      index,
      idPrefix
    )
  );

  const enriched = await mapPool(mapped, ENRICH_CONCURRENCY, async (company) => {
    try {
      const criteria = {
        industry: params.industry,
        country: params.country,
        companySizeMin: params.companySizeMin,
        companySizeMax: params.companySizeMax,
        technologies: params.technologies,
        keywords: params.keywords,
      };
      return await enrichCompanyFromWebsite(company, params.industry, criteria);
    } catch {
      return company;
    }
  });

  const { companies: matched, filteredCount, relaxedMatch, rejected } = applyCriteria(
    enriched,
    params,
    { targetMinResults: Math.max(30, params.perPage * 3) }
  );

  if (filteredCount > 0) {
    log.info("Ranked/filtered companies by search fit", {
      industry: params.industry,
      removed: filteredCount,
      kept: matched.length,
      relaxedMatch,
    });
  }

  const totalEntries = matched.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / params.perPage));
  const start = (params.page - 1) * params.perPage;
  const pageSlice = matched.slice(start, start + params.perPage);

  return {
    companies: pageSlice,
    pagination: {
      page: params.page,
      perPage: params.perPage,
      totalEntries,
      totalPages,
      hasMore: params.page < totalPages,
    },
    stats: {
      seedCount: seeds.length,
      enrichedCount: enriched.length,
      filteredCount,
      relaxedMatch,
      rejectedCount: rejected.length,
    },
    rejected,
  };
}

export function requireCompanySearchQuery(
  params: CompanyDiscoveryParams,
  buildQuery: () => string
): string {
  const query = buildQuery();
  if (!query) {
    throw new CompanyDiscoveryError(
      "VALIDATION_ERROR",
      "Add an industry or country to your search, then try again.",
      { statusCode: 400, retryable: false }
    );
  }
  return query;
}
