import type { CompanyDiscoveryParams } from "@/types/company";
import type { SearchRecord } from "@/types/search";

export function mapSearchToDiscoveryParams(
  search: SearchRecord,
  page = 1,
  perPage = 25
): CompanyDiscoveryParams {
  return {
    industry: search.industry,
    country: search.country,
    companySizeMin: search.companySizeMin,
    companySizeMax: search.companySizeMax,
    keywords: search.keywords,
    technologies: search.technologies,
    exclusions: search.exclusions,
    page,
    perPage,
  };
}

export function buildEmployeeRange(
  min: number | null,
  max: number | null
): string | null {
  if (min !== null && max !== null) return `${min},${max}`;
  if (min !== null) return `${min},100000`;
  if (max !== null) return `1,${max}`;
  return null;
}

export function normalizeLocation(country: string): string {
  return country.toLowerCase().replace(/\s+/g, " ").trim();
}
