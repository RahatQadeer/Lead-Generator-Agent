import type { CompanyCriteriaFilters } from "@/lib/company-discovery/apply-criteria";
import { matchesCountry } from "@/lib/company-discovery/apply-criteria-helpers";
import { isLikelyCompanyDomain } from "@/lib/scraping/extract-domain";
import { parseEmployeeCountFromText } from "@/lib/scraping/firmographics";
import type { DiscoveredCompany } from "@/types/company";

export interface CompanyVerificationResult {
  passed: boolean;
  notes: string[];
  checks: {
    name: boolean;
    website: boolean;
    industry: boolean;
    headquarters: boolean;
    size: boolean;
  };
}

const FOUNDED_YEAR_PATTERN = /\b(?:founded|established|since)\s*(?:in\s*)?((?:19|20)\d{2})\b/i;

export function parseFoundedYear(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(FOUNDED_YEAR_PATTERN);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1800 && year <= new Date().getFullYear() ? year : null;
}

/**
 * Verify company profile fields from scraped data — Apollo-style sanity checks.
 */
export function verifyCompanyProfile(
  company: DiscoveredCompany,
  filters: CompanyCriteriaFilters
): CompanyVerificationResult {
  const notes: string[] = [];

  const hasName = Boolean(company.name?.trim() && company.name.length >= 2);
  if (hasName) notes.push(`Name: ${company.name}`);
  else notes.push("Missing company name");

  const hasWebsite =
    Boolean(company.websiteUrl?.startsWith("http")) ||
    Boolean(company.domain && isLikelyCompanyDomain(company.domain));
  if (hasWebsite) notes.push(`Website: ${company.domain ?? company.websiteUrl}`);
  else notes.push("No verified website");

  const hasIndustry = Boolean(company.industry?.trim());
  if (hasIndustry) notes.push(`Industry: ${company.industry}`);
  else notes.push("Industry not detected");

  const hasHq = Boolean(
    company.country?.trim() ||
      (filters.country && matchesCountry(company, filters.country))
  );
  if (company.country) notes.push(`HQ: ${company.country}`);
  else if (hasHq) notes.push(`Likely in ${filters.country}`);
  else notes.push("Headquarters unknown");

  const headcount =
    company.employeeCount ??
    parseEmployeeCountFromText(company.description ?? "");
  const hasSize = headcount !== null;
  if (hasSize) notes.push(`Size: ~${headcount} employees`);
  else notes.push("Employee count unknown");

  const founded = parseFoundedYear(company.description);
  if (founded) notes.push(`Founded: ${founded}`);

  const checks = {
    name: hasName,
    website: hasWebsite,
    industry: hasIndustry,
    headquarters: hasHq,
    size: hasSize || filters.companySizeMin === null,
  };

  const passed =
    hasName && hasWebsite && (hasIndustry || !filters.industry) && checks.headquarters;

  return { passed, notes, checks };
}
