import type { CompanyCriteriaFilters } from "@/lib/company-discovery/apply-criteria";
import type { ParsedContact } from "@/lib/scraping/parse-html";
import { inferIndustryFromContent } from "@/lib/scraping/industry-classifier";
import { extractFirmographics } from "@/lib/scraping/firmographics";
import { applyKnownBrandToCompany } from "@/lib/scraping/known-brands";
import {
  normalizeCountryName,
  countryHintFromDomain,
  textMentionsCountry,
} from "@/lib/search/country-aliases";
import {
  sanitizeCompanyLinkedInForCompany,
} from "@/lib/scraping/data-quality";
import { FAST_FETCH } from "@/lib/scraping/http-client";
import { normalizeWebsiteUrl } from "@/lib/scraping/extract-domain";
import { discoverCompanyLinkedInWithSnippet } from "@/lib/scraping/linkedin-company-search";
import { scrapeCompanyMetadataFromUrl } from "@/lib/scraping/scrape-page";
import {
  verifyWebsite,
  type WebsiteStatus,
} from "@/lib/scraping/website-verification";
import { computeSemanticRelevance } from "@/lib/company-discovery/semantic-relevance";
import {
  companyCacheKey,
  getScrapeCache,
  setScrapeCache,
} from "@/lib/scraping/scrape-cache";
import type { DiscoveredCompany } from "@/types/company";

export interface CachedCompanyProfile {
  name: string | null;
  description: string | null;
  industry: string | null;
  linkedinUrl: string | null;
  technologies: string[];
  websiteUrl: string;
  /** Liveness verdict captured at scrape time (added for verification). */
  websiteStatus?: WebsiteStatus;
  /** 0-100 website quality rating captured at scrape time. */
  qualityScore?: number | null;
}

function computeCompanyConfidence(company: {
  domain: string | null;
  description: string | null;
  industry: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  employeeCount: number | null;
  websiteStatus?: WebsiteStatus | null;
  qualityScore?: number | null;
}): number {
  let score = 45;
  if (company.domain) score += 15;
  if (company.description && company.description.length > 40) score += 15;
  if (company.industry) score += 10;
  if (company.linkedinUrl) score += 10;
  if (company.employeeCount) score += 5;
  if (company.websiteUrl?.startsWith("http")) score += 5;
  // A verified-live site with real structural pages is strong corroboration.
  if (company.websiteStatus === "live") score += 5;
  if ((company.qualityScore ?? 0) >= 60) score += 5;
  return Math.min(100, score);
}

/** Attach the deterministic semantic-relevance signal for the search criteria. */
function withSemanticRelevance(
  company: DiscoveredCompany,
  criteria?: CompanyCriteriaFilters
): DiscoveredCompany {
  if (!criteria?.industry?.trim()) return company;
  const { score } = computeSemanticRelevance(
    { industry: criteria.industry, keywords: criteria.keywords, technologies: criteria.technologies },
    {
      name: company.name,
      industry: company.industry,
      description: company.description,
      technologies: company.technologies,
    }
  );
  return { ...company, semanticRelevance: score };
}

function withSearchCountry(
  company: DiscoveredCompany,
  criteria?: CompanyCriteriaFilters
): DiscoveredCompany {
  // IMPORTANT: Do not blindly overwrite missing company.country with the
  // user's search country. That makes all results appear to match.
  //
  // Only infer country when we have a strong public hint:
  // - a country TLD hint from the domain (e.g. .se, .pk)
  // - explicit mention of the country in the scraped/seed description
  if (company.country || !criteria?.country) return company;

  const target = criteria.country.trim();
  if (!target) return company;

  const domainHint = countryHintFromDomain(company.domain);
  if (domainHint && normalizeCountryName(domainHint) === normalizeCountryName(target)) {
    return { ...company, country: target };
  }

  const description = (company.description ?? "").trim();
  if (description && textMentionsCountry(description, target)) {
    return { ...company, country: target };
  }

  return company;
}

export async function enrichCompanyFromWebsite(
  company: DiscoveredCompany,
  industryHint: string,
  criteria?: CompanyCriteriaFilters
): Promise<DiscoveredCompany> {
  const seeded = applyKnownBrandToCompany(company);
  if (!seeded.domain) {
    return withSemanticRelevance(
      withSearchCountry(
        { ...seeded, confidenceScore: computeCompanyConfidence(seeded) },
        criteria
      ),
      criteria
    );
  }

  const domain = seeded.domain.replace(/^www\./, "");
  const cacheKey = companyCacheKey(domain);
  const cached = await getScrapeCache<CachedCompanyProfile>(cacheKey);

    if (cached) {
    const fromCache: DiscoveredCompany = {
      ...seeded,
      name: cached.name ?? seeded.name,
      description: cached.description ?? seeded.description,
      industry: cached.industry ?? seeded.industry,
      linkedinUrl:
        sanitizeCompanyLinkedInForCompany(
          cached.linkedinUrl ?? seeded.linkedinUrl,
          cached.name ?? seeded.name,
          domain
        ) ?? null,
      websiteUrl: cached.websiteUrl ?? seeded.websiteUrl,
      technologies:
        cached.technologies.length > 0 ? cached.technologies : seeded.technologies,
      websiteStatus: cached.websiteStatus ?? null,
      qualityScore: cached.qualityScore ?? null,
      confidenceScore: computeCompanyConfidence({
        ...seeded,
        description: cached.description ?? seeded.description,
        industry: cached.industry ?? seeded.industry,
        linkedinUrl: cached.linkedinUrl,
        websiteStatus: cached.websiteStatus ?? null,
        qualityScore: cached.qualityScore ?? null,
      }),
    };

    return withSemanticRelevance(
      withSearchCountry(applyKnownBrandToCompany(fromCache), criteria),
      criteria
    );
  }

  const url = normalizeWebsiteUrl(domain);
  const { metadata, html, reachable } = await scrapeCompanyMetadataFromUrl(
    url,
    domain,
    FAST_FETCH
  );

  const website = verifyWebsite({ reachable, html, title: metadata?.title ?? null });
  const websiteStatus = website.status;
  const qualityScore = website.quality?.qualityScore ?? null;

  const scrapedDesc = metadata?.description?.slice(0, 400) ?? "";
  const seedDesc = seeded.description ?? "";
  const description =
    [scrapedDesc, seedDesc].filter(Boolean).join(" ").trim().slice(0, 500) || null;
  let linkedinUrl = sanitizeCompanyLinkedInForCompany(
    metadata?.socialLinks.linkedin ?? seeded.linkedinUrl ?? null,
    seeded.name,
    domain
  );
  let linkedinSnippet = "";
  if (!linkedinUrl) {
    const linkedInDiscovery = await discoverCompanyLinkedInWithSnippet(seeded.name, domain);
    linkedinUrl =
      sanitizeCompanyLinkedInForCompany(
        linkedInDiscovery?.linkedinUrl ?? null,
        seeded.name,
        domain
      ) ?? null;
    linkedinSnippet = linkedInDiscovery?.snippet ?? "";
  }
  const firmographics = extractFirmographics([
    description,
    seedDesc,
    linkedinSnippet,
    metadata?.description,
  ]);
  const industry =
    inferIndustryFromContent(description, seeded.name, industryHint) ?? seeded.industry;
  const technologies =
    metadata?.technologies?.length ? metadata.technologies : seeded.technologies;

  const profile: CachedCompanyProfile = {
    name: metadata?.title ?? seeded.name,
    description,
    industry,
    linkedinUrl,
    technologies: technologies ?? [],
    websiteUrl: url,
    websiteStatus,
    qualityScore,
  };

  await setScrapeCache(cacheKey, "company", profile);

  const enriched: DiscoveredCompany = {
    ...seeded,
    name: profile.name && profile.name.length <= 80 ? profile.name : seeded.name,
    description,
    industry,
    linkedinUrl,
    websiteUrl: url,
    technologies: technologies ?? seeded.technologies,
    employeeCount: firmographics.employeeCount ?? seeded.employeeCount,
    country: firmographics.country ?? seeded.country,
    websiteStatus,
    qualityScore,
    confidenceScore: computeCompanyConfidence({
      ...seeded,
      description,
      industry,
      linkedinUrl,
      websiteUrl: url,
      employeeCount: firmographics.employeeCount ?? seeded.employeeCount,
      websiteStatus,
      qualityScore,
    }),
  };

  return withSemanticRelevance(
    withSearchCountry(applyKnownBrandToCompany(enriched), criteria),
    criteria
  );
}

export type { ParsedContact };
