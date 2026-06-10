import type { SearchExclusions, SearchRecord } from "@/types/search";

const DOMAIN_PATTERN =
  /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

export function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function isValidDomain(domain: string): boolean {
  return DOMAIN_PATTERN.test(domain);
}

export function hasExclusions(search: SearchRecord): boolean {
  const { exclusions } = search;
  return (
    exclusions.domains.length > 0 ||
    exclusions.industries.length > 0 ||
    exclusions.keywords.length > 0 ||
    exclusions.countries.length > 0
  );
}

export function countExclusions(exclusions: SearchExclusions): number {
  return (
    exclusions.domains.length +
    exclusions.industries.length +
    exclusions.keywords.length +
    exclusions.countries.length
  );
}
