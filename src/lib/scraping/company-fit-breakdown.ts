import type { CompanyCriteriaFilters } from "@/lib/company-discovery/apply-criteria";
import {
  matchesCountry,
  matchesSize,
  scoreIndustryMatch,
} from "@/lib/company-discovery/apply-criteria-helpers";
import {
  assessCompanyRelevance,
  matchesSearchKeywords,
  searchTargetsTechnology,
} from "@/lib/scraping/company-relevance";
import { verifyCompanyProfile } from "@/lib/scraping/company-verification";
import { countryHintFromDomain } from "@/lib/search/country-aliases";
import type { DiscoveredCompany } from "@/types/company";

export interface FitScoreFactor {
  label: string;
  score: number;
  max: number;
  reason: string;
}

export interface CompanyFitBreakdown {
  overall: number;
  factors: FitScoreFactor[];
  verificationPassed: boolean;
  verificationNotes: string[];
}

function pct(value: number, max: number): number {
  return Math.round((value / max) * 100);
}

/**
 * Explainable company fit score — shows why each company was ranked.
 */
export function computeCompanyFitBreakdown(
  company: DiscoveredCompany,
  filters: CompanyCriteriaFilters
): CompanyFitBreakdown {
  const factors: FitScoreFactor[] = [];
  const verification = verifyCompanyProfile(company, filters);

  const industryRaw = scoreIndustryMatch(company, filters.industry);
  const industryPts = Math.round(industryRaw * 28);
  factors.push({
    label: "Industry",
    score: industryPts,
    max: 28,
    reason:
      industryRaw >= 0.7
        ? `Matches ${filters.industry || "target industry"}`
        : industryRaw >= 0.4
          ? `Partial industry signal`
          : `Weak industry match`,
  });

  const keywords = filters.keywords ?? [];
  let keywordRaw = 1;
  if (keywords.length > 0) {
    keywordRaw = matchesSearchKeywords(company, keywords) ? 1 : 0.5;
  }
  const keywordPts = Math.round(keywordRaw * 18);
  factors.push({
    label: "Keywords",
    score: keywordPts,
    max: 18,
    reason:
      keywords.length === 0
        ? "No keyword filter"
        : keywordRaw >= 1
          ? `Matches: ${keywords.join(", ")}`
          : `Found via search; homepage lacks explicit keywords`,
  });

  let countryRaw = 1;
  if (filters.country.trim()) {
    if (company.country?.trim()) {
      countryRaw = matchesCountry(company, filters.country) ? 1 : 0.25;
    } else {
      const hint = countryHintFromDomain(company.domain);
      countryRaw = matchesCountry(company, filters.country) ? 0.85 : hint ? 0.55 : 0.55;
    }
  }
  const countryPts = Math.round(countryRaw * 18);
  factors.push({
    label: "Location",
    score: countryPts,
    max: 18,
    reason: company.country
      ? `HQ: ${company.country}`
      : countryHintFromDomain(company.domain)
        ? `Domain suggests ${countryHintFromDomain(company.domain)}`
        : filters.country
          ? `Target: ${filters.country}`
          : "No country filter",
  });

  let sizeRaw = 1;
  if (filters.companySizeMin !== null || filters.companySizeMax !== null) {
    if (company.employeeCount === null) {
      sizeRaw = 0.35;
    } else if (
      matchesSize(company, filters.companySizeMin, filters.companySizeMax)
    ) {
      sizeRaw = 1;
    } else {
      sizeRaw = 0;
    }
  }
  const sizePts = Math.round(sizeRaw * 14);
  factors.push({
    label: "Company size",
    score: sizePts,
    max: 14,
    reason: company.employeeCount
      ? `~${company.employeeCount} employees`
      : "Headcount not published",
  });

  const confidenceRaw = Math.min(1, (company.confidenceScore ?? 0) / 100);
  const confidencePts = Math.round(confidenceRaw * 12);
  factors.push({
    label: "Data quality",
    score: confidencePts,
    max: 12,
    reason: `Profile completeness ${company.confidenceScore ?? 0}%`,
  });

  const linkedinPts = company.linkedinUrl ? 5 : 3;
  factors.push({
    label: "LinkedIn",
    score: linkedinPts,
    max: 5,
    reason: company.linkedinUrl ? "Company LinkedIn found" : "No LinkedIn URL",
  });

  const techSearch = searchTargetsTechnology({
    industry: filters.industry,
    keywords: filters.keywords ?? [],
  });
  const techPts =
    techSearch && scoreIndustryMatch(company, filters.industry) >= 0.5 ? 5 : techSearch ? 2 : 5;
  factors.push({
    label: "Business type",
    score: techPts,
    max: 5,
    reason: techSearch ? "Technology/SaaS search" : "General search",
  });

  let overall = Math.min(100, factors.reduce((sum, f) => sum + f.score, 0));

  const relevance = assessCompanyRelevance(company, {
    industry: filters.industry,
    keywords: filters.keywords ?? [],
  });
  if (!relevance.relevant) {
    overall = Math.round(overall * 0.7);
    factors.push({
      label: "Relevance penalty",
      score: -Math.round(overall * 0.3),
      max: 0,
      reason: relevance.reason ?? "Lower relevance signal",
    });
  }

  return {
    overall,
    factors,
    verificationPassed: verification.passed,
    verificationNotes: verification.notes,
  };
}
