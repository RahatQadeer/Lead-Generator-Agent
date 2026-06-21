import { normalizeLocation } from "@/lib/company-discovery/map-criteria";
import type { CompanyDiscoveryParams, DiscoveredCompany } from "@/types/company";

export type CompanyCriteriaFilters = Pick<
  CompanyDiscoveryParams,
  "industry" | "country" | "companySizeMin" | "companySizeMax" | "technologies"
>;

export function matchesIndustry(
  company: DiscoveredCompany,
  industry: string
): boolean {
  if (!industry) return true;

  const target = industry.toLowerCase().trim();
  const companyIndustry = company.industry?.toLowerCase().trim() ?? "";
  return companyIndustry === target;
}

export function matchesCountry(
  company: DiscoveredCompany,
  country: string
): boolean {
  if (!country) return true;

  const target = normalizeLocation(country);
  const companyCountry = normalizeLocation(company.country ?? "");
  if (!companyCountry) return false;

  return companyCountry === target || companyCountry.includes(target);
}

export function matchesSize(
  company: DiscoveredCompany,
  min: number | null,
  max: number | null
): boolean {
  if (min === null && max === null) return true;
  if (company.employeeCount === null) return true;

  if (min !== null && company.employeeCount < min) return false;
  if (max !== null && company.employeeCount > max) return false;
  return true;
}

function companyTechnologyText(company: DiscoveredCompany): string {
  return [
    company.name,
    company.domain ?? "",
    company.industry ?? "",
    company.websiteUrl ?? "",
    ...(company.technologies ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function companyHasTechnology(
  company: DiscoveredCompany,
  technology: string
): boolean {
  const needle = technology.toLowerCase().trim();
  if (!needle) return true;

  const listed = company.technologies ?? [];
  if (
    listed.some(
      (tech) =>
        tech.toLowerCase().includes(needle) ||
        needle.includes(tech.toLowerCase())
    )
  ) {
    return true;
  }

  return companyTechnologyText(company).includes(needle);
}

export function matchesTechnologies(
  company: DiscoveredCompany,
  technologies: string[]
): boolean {
  if (technologies.length === 0) return true;
  return technologies.every((tech) => companyHasTechnology(company, tech));
}

export function matchesCompanyCriteria(
  company: DiscoveredCompany,
  filters: CompanyCriteriaFilters
): boolean {
  return (
    matchesIndustry(company, filters.industry) &&
    matchesCountry(company, filters.country) &&
    matchesSize(
      company,
      filters.companySizeMin,
      filters.companySizeMax
    ) &&
    matchesTechnologies(company, filters.technologies)
  );
}

export function applyCriteria(
  companies: DiscoveredCompany[],
  filters: CompanyCriteriaFilters
): { companies: DiscoveredCompany[]; filteredCount: number } {
  const matched = companies.filter((company) =>
    matchesCompanyCriteria(company, filters)
  );

  return {
    companies: matched,
    filteredCount: companies.length - matched.length,
  };
}
