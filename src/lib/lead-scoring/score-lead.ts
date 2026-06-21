import {
  matchesCountry,
  matchesIndustry,
  matchesSize,
  matchesTechnologies,
} from "@/lib/company-discovery/apply-criteria";
import { matchesJobTitle } from "@/lib/contact-discovery/apply-title-filter";
import type { DiscoveredCompany } from "@/types/company";
import type {
  LeadScoreFactors,
  LeadScoringInput,
  ScoredLeadResult,
  SearchScoringCriteria,
} from "@/types/lead-scoring";

function toDiscoveredCompany(company: LeadScoringInput["company"]): DiscoveredCompany {
  return {
    id: "scoring",
    name: company.name,
    domain: company.domain,
    industry: company.industry,
    employeeCount: company.employeeCount,
    country: company.country,
    city: null,
    state: null,
    linkedinUrl: null,
    websiteUrl: company.websiteUrl,
    technologies: company.technologies,
  };
}

export function scoreIndustryFactor(
  company: LeadScoringInput["company"],
  industry: string
): number {
  return matchesIndustry(toDiscoveredCompany(company), industry) ? 1 : 0;
}

export function scoreCompanySizeFactor(
  company: LeadScoringInput["company"],
  min: number | null,
  max: number | null
): number {
  if (min === null && max === null) return 1;
  if (company.employeeCount === null) return 0.5;
  return matchesSize(toDiscoveredCompany(company), min, max) ? 1 : 0;
}

export function scoreLocationFactor(
  company: LeadScoringInput["company"],
  country: string
): number {
  if (!country) return 1;
  return matchesCountry(toDiscoveredCompany(company), country) ? 1 : 0;
}

export function scoreJobRoleFactor(role: string, jobTitles: string[]): number {
  if (jobTitles.length === 0) return 1;
  return matchesJobTitle(role, jobTitles) ? 1 : 0;
}

export function scoreTechnologyFactor(
  company: LeadScoringInput["company"],
  technologies: string[]
): number {
  if (technologies.length === 0) return 1;

  const discovered = toDiscoveredCompany(company);
  const matched = technologies.filter((tech) =>
    matchesTechnologies(discovered, [tech])
  );

  return matched.length / technologies.length;
}

export function computeLeadScore(factors: LeadScoreFactors): number {
  const values = [
    factors.industryMatch,
    factors.companySize,
    factors.locationMatch,
    factors.jobRoleMatch,
    factors.technologyMatch,
  ];
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.max(1, Math.min(10, Math.round(1 + average * 9)));
}

export function scoreLead(
  input: LeadScoringInput,
  criteria: SearchScoringCriteria
): ScoredLeadResult {
  const factors: LeadScoreFactors = {
    industryMatch: scoreIndustryFactor(input.company, criteria.industry),
    companySize: scoreCompanySizeFactor(
      input.company,
      criteria.companySizeMin,
      criteria.companySizeMax
    ),
    locationMatch: scoreLocationFactor(input.company, criteria.country),
    jobRoleMatch: scoreJobRoleFactor(input.role, criteria.jobTitles),
    technologyMatch: scoreTechnologyFactor(input.company, criteria.technologies),
  };

  return {
    contactId: input.contactId,
    score: computeLeadScore(factors),
    factors,
    scoredAt: new Date().toISOString(),
  };
}

export function scoreLeads(
  inputs: LeadScoringInput[],
  criteria: SearchScoringCriteria
): { results: ScoredLeadResult[]; averageScore: number } {
  const results = inputs.map((input) => scoreLead(input, criteria));
  const averageScore =
    results.length > 0
      ? Math.round(
          (results.reduce((sum, result) => sum + result.score, 0) /
            results.length) *
            10
        ) / 10
      : 0;

  return { results, averageScore };
}
