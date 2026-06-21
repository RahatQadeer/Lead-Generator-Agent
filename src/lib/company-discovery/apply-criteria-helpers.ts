import {
  assessCompanyRelevance,
  passesHardRelevanceBlockers,
} from "@/lib/scraping/company-relevance";
import {
  companyMatchesIndustry,
  MIN_INDUSTRY_MATCH_SCORE,
} from "@/lib/scraping/industry-classifier";
import { countriesMatch } from "@/lib/search/country-aliases";
import type { CompanyCriteriaFilters } from "@/lib/company-discovery/apply-criteria";
import type { DiscoveredCompany } from "@/types/company";

function industryMatchResult(company: DiscoveredCompany, industry: string) {
  return companyMatchesIndustry(
    {
      name: company.name,
      domain: company.domain,
      industry: company.industry,
      description: company.description,
      websiteUrl: company.websiteUrl,
    },
    industry
  );
}

export function matchesIndustry(
  company: DiscoveredCompany,
  industry: string
): boolean {
  if (!industry) return true;
  const result = industryMatchResult(company, industry);
  return result.matches && result.score >= MIN_INDUSTRY_MATCH_SCORE;
}

export function scoreIndustryMatch(
  company: DiscoveredCompany,
  industry: string
): number {
  if (!industry) return 1;
  return industryMatchResult(company, industry).score;
}

export function matchesCountry(
  company: DiscoveredCompany,
  country: string
): boolean {
  if (!country.trim()) return true;

  return countriesMatch(company.country, country, {
    domain: company.domain,
    description: company.description,
  });
}

/** Strict size match — unknown headcount does not pass when a range is set. */
export function matchesSize(
  company: DiscoveredCompany,
  min: number | null,
  max: number | null
): boolean {
  if (min === null && max === null) return true;
  if (company.employeeCount === null) return false;

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

export function passesHardCompanyGate(
  company: DiscoveredCompany,
  filters: CompanyCriteriaFilters
): boolean {
  const search = {
    industry: filters.industry,
    keywords: filters.keywords ?? [],
  };

  if (!passesHardRelevanceBlockers(company, search).relevant) return false;

  if (filters.technologies.length > 0 && !matchesTechnologies(company, filters.technologies)) {
    return false;
  }

  return true;
}

export function matchesCompanyCriteria(
  company: DiscoveredCompany,
  filters: CompanyCriteriaFilters
): boolean {
  const search = {
    industry: filters.industry,
    keywords: filters.keywords ?? [],
  };

  if (!passesHardCompanyGate(company, filters)) return false;
  if (!matchesIndustry(company, filters.industry)) return false;
  if (!assessCompanyRelevance(company, search).relevant) return false;

  return (
    matchesCountry(company, filters.country) &&
    matchesSize(company, filters.companySizeMin, filters.companySizeMax)
  );
}
