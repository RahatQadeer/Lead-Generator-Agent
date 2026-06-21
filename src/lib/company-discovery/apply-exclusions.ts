import { normalizeDomain } from "@/lib/search/exclusions";
import type { DiscoveredCompany } from "@/types/company";
import type { SearchExclusions } from "@/types/search";

function matchesKeyword(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

export function applyExclusions(
  companies: DiscoveredCompany[],
  exclusions: SearchExclusions
): { companies: DiscoveredCompany[]; excludedCount: number } {
  if (
    exclusions.domains.length === 0 &&
    exclusions.industries.length === 0 &&
    exclusions.keywords.length === 0 &&
    exclusions.countries.length === 0
  ) {
    return { companies, excludedCount: 0 };
  }

  const excludedDomains = new Set(
    exclusions.domains.map((d) => normalizeDomain(d))
  );
  const excludedIndustries = exclusions.industries.map((i) =>
    i.toLowerCase()
  );
  const excludedKeywords = exclusions.keywords.map((k) => k.toLowerCase());
  const excludedCountries = exclusions.countries.map((c) => c.toLowerCase());

  const filtered = companies.filter((company) => {
    const domain = company.domain
      ? normalizeDomain(company.domain)
      : null;
    if (domain && excludedDomains.has(domain)) return false;

    const industry = company.industry?.toLowerCase() ?? "";
    if (
      excludedIndustries.some(
        (ex) => ex === industry || industry.includes(ex)
      )
    ) {
      return false;
    }

    const country = company.country?.toLowerCase() ?? "";
    if (excludedCountries.some((ex) => country.includes(ex))) return false;

    const searchable = [company.name, company.industry ?? ""]
      .join(" ")
      .toLowerCase();
    if (
      excludedKeywords.some((keyword) => matchesKeyword(searchable, keyword))
    ) {
      return false;
    }

    return true;
  });

  return {
    companies: filtered,
    excludedCount: companies.length - filtered.length,
  };
}
