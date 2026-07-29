import { applyCriteria } from "@/lib/company-discovery/apply-criteria";
import { CompanyDiscoveryError } from "@/lib/company-discovery/errors";
import type { ProviderSearchResult } from "@/lib/company-discovery/types";
import { createLogger } from "@/lib/logger";
import {
  isInvestorOrAcceleratorOrganization,
  isNonCommercialOrganization,
} from "@/lib/scraping/org-type-blockers";
import { cleanCompanyNameFromSearchTitle, isHistoricalOrDefunctName, looksLikePersonName } from "@/lib/scraping/company-search-filter";
import { searchTargetsInvestors } from "@/lib/scraping/company-relevance";
import {
  detectCompanyType,
  investorCategoryLabel,
  isInvestorCompanyType,
} from "@/lib/scraping/company-type";
import { detectFundingStage } from "@/lib/scraping/funding-stage";
import { sanitizeCompanyLinkedInForCompany } from "@/lib/scraping/data-quality";
import { isDeadWebsiteStatus } from "@/lib/scraping/website-verification";
import {
  collectCompanySources,
  computeCompanyVerification,
  type CompanySource,
} from "@/lib/company-discovery/company-verification";
import { enrichCompanyFromWebsite } from "@/lib/scraping/enrich-company";
import { isLikelyCompanyDomain } from "@/lib/scraping/extract-domain";
import { mapPool } from "@/lib/scraping/parallel-pool";
import type { MergedCompanySeed } from "@/lib/scraping/merge-company-seeds";
import { rankMergedSeedsBySearch, seedLooksForeign } from "@/lib/scraping/rank-search-seeds";
import type { ProgressReporter } from "@/lib/sse/stream";
import type { CompanyDiscoveryParams, DiscoveredCompany } from "@/types/company";

const log = createLogger("company-discovery.pipeline");
const ENRICH_CONCURRENCY = 3;
const RESULT_LIMIT = 500;

/**
 * Test-run cap on how many companies a single discovery run processes.
 * Unset (the default) means no cap — the normal production behavior.
 * Set `DISCOVERY_MAX_COMPANIES=20` to keep test runs fast; unset it to restore full runs.
 */
function maxCompaniesPerRun(): number | null {
  const raw = process.env.DISCOVERY_MAX_COMPANIES?.trim();
  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return Math.floor(parsed);
}

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
    directorySource?: MergedCompanySeed["directorySource"];
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

  const linkedinUrl =
    sanitizeCompanyLinkedInForCompany(seed.linkedinUrl ?? null, seed.name, seed.domain) ?? null;

  // Seed the source list from discovery origin (directory tool / web search /
  // LinkedIn). The live-website source is added later, once liveness is verified.
  const sources = collectCompanySources({
    seedSource: seed.seedSource,
    directorySource: seed.directorySource,
    linkedinUrl,
    websiteUrl: seed.url,
  });

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
    linkedinUrl,
    websiteUrl: seed.url,
    technologies: null,
    confidenceScore: Math.min(85, (fromDirectory ? 55 : 40) + completenessBoost),
    sources,
  };
}

/**
 * Finalize a company's verification verdict after website enrichment: fold the
 * verified-live website (and any enriched LinkedIn) into its source list, then
 * compute cross-verification + validation status. Pure per-company transform.
 */
function finalizeCompanyVerification(company: DiscoveredCompany): DiscoveredCompany {
  const byKind = new Map<CompanySource["kind"], CompanySource>();
  for (const source of company.sources ?? []) byKind.set(source.kind, source);

  const websiteAndLinkedIn = collectCompanySources({
    // seedSource intentionally omitted here — only add the two enrichment-derived
    // sources (live website, resolved LinkedIn); origin sources are already present.
    websiteStatus: company.websiteStatus ?? null,
    websiteUrl: company.websiteUrl,
    linkedinUrl: company.linkedinUrl,
  });
  for (const source of websiteAndLinkedIn) {
    if (!byKind.has(source.kind)) byKind.set(source.kind, source);
  }

  const sources = [...byKind.values()];
  const verification = computeCompanyVerification({
    websiteStatus: company.websiteStatus ?? null,
    sources,
    confidenceScore: company.confidenceScore,
    semanticRelevance: company.semanticRelevance ?? null,
  });

  return {
    ...company,
    sources,
    validationStatus: verification.status,
    validationReasons: verification.reasons,
  };
}

/**
 * Attach org type, VC category, and funding stage.
 *
 * `detectCompanyType` already ran during discovery only to *reject* companies; here the
 * verdict is kept so a fund can be labeled "Venture capital" in the output instead of
 * silently dropped.
 */
function attachCompanyClassification(company: DiscoveredCompany): DiscoveredCompany {
  const { type } = detectCompanyType(company);
  const text = [company.name, company.description, company.industry]
    .filter(Boolean)
    .join(" ");

  return {
    ...company,
    companyType: type,
    vcCategory: investorCategoryLabel(type),
    // A fund's own "Series A" talk is about its portfolio, not itself.
    fundingStage: isInvestorCompanyType(type) ? null : detectFundingStage(text),
  };
}

/** Enrich, filter, and paginate merged company seeds (shared by scraping + Apify providers). */
export async function finalizeCompanyDiscovery(
  params: CompanyDiscoveryParams,
  mergedSeeds: MergedCompanySeed[],
  options: {
    idPrefix?: string;
    emptyLogMessage?: string;
    onProgress?: ProgressReporter;
  } = {}
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

  // VCs/accelerators are dropped from ordinary B2B discovery, but a search that asks
  // for investors should get them.
  const allowInvestors = searchTargetsInvestors({
    industry: params.industry,
    keywords: params.keywords,
    searchName: params.searchName,
  });

  const matchingSeeds = rankedSeeds.filter((result) => {
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

    if (allowInvestors) return true;

    return !isInvestorOrAcceleratorOrganization({
      name: result.title,
      description: result.snippet,
      domain: result.domain,
    }).blocked;
  });

  // Cap before enrichment, not after: enrichment is the slow part (a live website
  // fetch per company), so capping the output alone would not make a test run faster.
  // Seeds are already ranked by search fit, so the kept ones are the best matches.
  const maxCompanies = maxCompaniesPerRun();
  const seeds =
    maxCompanies === null ? matchingSeeds : matchingSeeds.slice(0, maxCompanies);

  if (maxCompanies !== null && matchingSeeds.length > seeds.length) {
    log.info("DISCOVERY_MAX_COMPANIES cap applied — this is a reduced test run", {
      matched: matchingSeeds.length,
      processing: seeds.length,
      skipped: matchingSeeds.length - seeds.length,
    });
  }

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
        directorySource: seed.directorySource,
        linkedinUrl: seed.socialLinks?.linkedin ?? null,
        completenessScore: seed.completenessScore,
        industryHint: seed.industryHint,
        phone: seed.phone,
      },
      index,
      idPrefix
    )
  );

  const enrichTotal = mapped.length;
  let enrichDone = 0;
  options.onProgress?.({
    phase: "Validating company websites…",
    current: 0,
    total: enrichTotal,
  });

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
    } finally {
      enrichDone += 1;
      options.onProgress?.({
        phase: "Validating company websites…",
        current: enrichDone,
        total: enrichTotal,
        label: company.name,
      });
    }
  });

  // Label the org type and funding stage once, after enrichment has filled in the
  // description/website text these read from.
  const labeled = enriched.map(attachCompanyClassification);

  // Verification gate: attach cross-verification + validation status, then drop
  // companies whose website is affirmatively dead (parked / placeholder / error).
  // Transient unreachable/low-content sites are kept and flagged, not rejected —
  // rejecting a real company because our bot was blocked would destroy recall.
  const verifiedCompanies = labeled.map(finalizeCompanyVerification);
  const liveCompanies = verifiedCompanies.filter(
    (company) => !isDeadWebsiteStatus(company.websiteStatus)
  );
  const deadSiteRejections = verifiedCompanies
    .filter((company) => isDeadWebsiteStatus(company.websiteStatus))
    .map((company) => ({
      name: company.name,
      domain: company.domain,
      companyType: "Unverified website",
      reasons: company.validationReasons ?? [`Website not live (${company.websiteStatus})`],
    }));

  if (deadSiteRejections.length > 0) {
    log.info("Dropped companies with dead/parked websites", {
      removed: deadSiteRejections.length,
    });
  }

  const {
    companies: matched,
    filteredCount,
    relaxedMatch,
    rejected: criteriaRejected,
  } = applyCriteria(liveCompanies, params, {
    targetMinResults: Math.max(50, params.perPage * 5),
    maxResults: RESULT_LIMIT,
  });

  const rejected = [...deadSiteRejections, ...criteriaRejected];

  if (filteredCount > 0) {
    log.info("Ranked/filtered companies by search fit", {
      industry: params.industry,
      removed: filteredCount,
      kept: matched.length,
      relaxedMatch,
    });
  }

  const totalEntries = matched.length;
  // Return the full matched set in a single run. Every matched company was already
  // enriched above, so slicing to one page would throw away (and never persist) work
  // we already paid for — the root cause of "found 137 companies but only 50 shown".
  // The UI reveals results in client-side batches, so all discovered companies are
  // displayed and saved. A generous safety cap bounds payload/persistence size.
  const companies = matched.slice(0, RESULT_LIMIT);
  if (matched.length > RESULT_LIMIT) {
    log.info("Capped discovery results to protect payload size", {
      found: matched.length,
      returned: RESULT_LIMIT,
    });
  }

  return {
    companies,
    pagination: {
      page: params.page,
      perPage: params.perPage,
      totalEntries,
      totalPages: 1,
      hasMore: false,
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
