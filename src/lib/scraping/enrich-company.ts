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
}

function computeCompanyConfidence(company: {
  domain: string | null;
  description: string | null;
  industry: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  employeeCount: number | null;
}): number {
  let score = 45;
  if (company.domain) score += 15;
  if (company.description && company.description.length > 40) score += 15;
  if (company.industry) score += 10;
  if (company.linkedinUrl) score += 10;
  if (company.employeeCount) score += 5;
  if (company.websiteUrl?.startsWith("http")) score += 5;
  return Math.min(100, score);
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
    return withSearchCountry(
      { ...seeded, confidenceScore: computeCompanyConfidence(seeded) },
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
      confidenceScore: computeCompanyConfidence({
        ...seeded,
        description: cached.description ?? seeded.description,
        industry: cached.industry ?? seeded.industry,
        linkedinUrl: cached.linkedinUrl,
      }),
    };

    return withSearchCountry(applyKnownBrandToCompany(fromCache), criteria);
  }

  const url = normalizeWebsiteUrl(domain);
  const { metadata } = await scrapeCompanyMetadataFromUrl(url, domain, FAST_FETCH);

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
    confidenceScore: computeCompanyConfidence({
      ...seeded,
      description,
      industry,
      linkedinUrl,
      websiteUrl: url,
      employeeCount: firmographics.employeeCount ?? seeded.employeeCount,
    }),
  };

  return withSearchCountry(applyKnownBrandToCompany(enriched), criteria);
}

export type { ParsedContact };
