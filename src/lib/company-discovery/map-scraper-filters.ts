import type { ScraperFilters } from "@/lib/scrapers/types";
import type { CompanyDiscoveryParams } from "@/types/company";

/** Translate a company search into scraper filters (industry, location, size, keywords). */
export function mapParamsToScraperFilters(
  params: CompanyDiscoveryParams
): ScraperFilters {
  const keywords = [
    ...(params.keywords ?? []),
    ...(params.technologies ?? []),
  ].filter(Boolean);

  return {
    industry: params.industry?.trim() || null,
    location: params.country?.trim() || null,
    companySizeMin: params.companySizeMin,
    companySizeMax: params.companySizeMax,
    keywords,
  };
}
