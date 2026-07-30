import { normalizeCountryName } from "@/lib/search/country-aliases";
import { INDUSTRY_SEARCH_ALIASES } from "@/lib/search/constants";

/**
 * YC Algolia `regions` facet labels for common search countries.
 * Mirrors the region filter on ycombinator.com/companies.
 */
export const YC_REGIONS_BY_COUNTRY: Record<string, string[]> = {
  "united states": ["United States of America"],
  canada: ["Canada"],
  "united kingdom": ["United Kingdom", "Europe"],
  india: ["India"],
  germany: ["Europe", "Germany"],
  france: ["Europe", "France"],
  singapore: ["Southeast Asia", "Singapore"],
  australia: ["Australia", "Oceania"],
  brazil: ["Latin America", "Brazil"],
  mexico: ["Latin America", "Mexico"],
  nigeria: ["Africa", "Nigeria"],
  pakistan: ["South Asia", "Pakistan"],
};

/**
 * Map our search industry labels to YC Algolia `industries` facet values.
 * The YC website filters with `?industry=Education` — not full-text search alone.
 */
export const YC_INDUSTRIES_BY_SEARCH: Record<string, string[]> = {
  education: ["Education"],
  edtech: ["Education"],
  logistics: ["Supply Chain and Logistics"],
  healthcare: ["Healthcare"],
  "financial services": ["Fintech"],
  fintech: ["Fintech"],
  finance: ["Fintech"],
  insurance: ["Fintech"],
  technology: ["B2B"],
  saas: ["B2B"],
  cybersecurity: ["B2B"],
  telecommunications: ["B2B"],
  consulting: ["B2B"],
  legal: ["B2B"],
  "e-commerce": ["Consumer", "Retail"],
  ecommerce: ["Consumer", "Retail"],
  retail: ["Consumer", "Retail"],
  hospitality: ["Consumer"],
  "media & entertainment": ["Consumer"],
  manufacturing: ["Industrials"],
  automotive: ["Industrials"],
  aerospace: ["Industrials"],
  construction: ["Real Estate and Construction"],
  "real estate": ["Real Estate and Construction"],
  energy: ["Industrials"],
  "oil & gas": ["Industrials"],
  agriculture: ["Industrials"],
  pharmaceuticals: ["Healthcare"],
  biotechnology: ["Healthcare"],
  government: ["Government"],
  nonprofit: ["Consumer"],
};

export function ycRegionsForCountry(country: string | null | undefined): string[] {
  if (!country?.trim()) return [];
  return YC_REGIONS_BY_COUNTRY[normalizeCountryName(country)] ?? [];
}

export function ycIndustriesForSearch(industry: string | null | undefined): string[] {
  if (!industry?.trim()) return [];

  const normalized = industry.toLowerCase().trim();
  const direct = YC_INDUSTRIES_BY_SEARCH[normalized];
  if (direct?.length) return direct;

  const aliasKey = Object.keys(INDUSTRY_SEARCH_ALIASES).find(
    (label) => label.toLowerCase() === normalized
  );
  if (aliasKey) {
    const fromLabel = YC_INDUSTRIES_BY_SEARCH[aliasKey.toLowerCase()];
    if (fromLabel?.length) return fromLabel;
  }

  return [industry.trim().replace(/\s+/g, " ")];
}

function facetLabelMatches(label: string, facet: string): boolean {
  if (label === facet) return true;
  // Avoid false positives like state code "ca" matching "america".
  if (label.length < 3 || facet.length < 3) return false;
  return label.includes(facet) || facet.includes(label);
}

/** True when a YC listing is tagged with the same industry facet the website uses. */
export function profileMatchesYcIndustryFacet(
  labels: Array<string | null | undefined>,
  industryPhrase: string
): boolean {
  const facets = ycIndustriesForSearch(industryPhrase).map((facet) => facet.toLowerCase());
  if (facets.length === 0) return false;

  const listed = labels
    .filter((label): label is string => Boolean(label?.trim()))
    .map((label) => label.toLowerCase());

  return facets.some((facet) =>
    listed.some((label) => facetLabelMatches(label, facet))
  );
}

/** True when a YC listing is tagged with a region facet matching the search country. */
export function profileMatchesYcRegionFacet(
  labels: Array<string | null | undefined>,
  countryPhrase: string
): boolean {
  const facets = ycRegionsForCountry(countryPhrase).map((facet) => facet.toLowerCase());
  if (facets.length === 0) return false;

  const listed = labels
    .filter((label): label is string => Boolean(label?.trim()))
    .map((label) => label.toLowerCase());

  return facets.some((facet) =>
    listed.some((label) => facetLabelMatches(label, facet))
  );
}

export function buildYcCompaniesListingUrl(filters: {
  industry?: string | null;
  country?: string | null;
}): string {
  const params = new URLSearchParams();
  const regions = ycRegionsForCountry(filters.country);
  if (regions.includes("Canada")) {
    params.set("regions", "Canada");
  } else if (regions.includes("United States of America")) {
    params.set("regions", "United States");
  } else if (filters.country?.trim()) {
    params.set("regions", filters.country.trim());
  }

  const industries = ycIndustriesForSearch(filters.industry);
  if (industries.length === 1) {
    params.set("industry", industries[0]!);
  }

  const query = params.toString();
  return query
    ? `https://www.ycombinator.com/companies?${query}`
    : "https://www.ycombinator.com/companies";
}
