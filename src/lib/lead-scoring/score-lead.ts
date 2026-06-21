import {
  matchesCountry,
  matchesSize,
  matchesTechnologies,
  scoreIndustryMatch,
} from "@/lib/company-discovery/apply-criteria-helpers";
import { matchesJobTitle } from "@/lib/contact-discovery/apply-title-filter";
import { companyMatchesIndustry } from "@/lib/scraping/industry-classifier";
import { scoreTitleRelevance } from "@/lib/scraping/relevance";
import { computeLeadConfidence } from "@/lib/lead-scoring/lead-confidence";
import {
  computeLeadQualityBreakdown,
} from "@/lib/lead-scoring/lead-quality-score";
import type { DiscoveredCompany } from "@/types/company";
import type { EmailSource, LinkedInSource } from "@/types/lead";
import {
  DEFAULT_LEAD_SCORING_WEIGHTS,
  type LeadScoringWeights,
} from "@/types/lead-scoring-settings";
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
    description: company.description,
    employeeCount: company.employeeCount,
    country: company.country,
    city: null,
    state: null,
    linkedinUrl: null,
    websiteUrl: company.websiteUrl,
    technologies: company.technologies,
    confidenceScore: 0,
  };
}

export function scoreIndustryFactor(
  company: LeadScoringInput["company"],
  industry: string
): number {
  return scoreIndustryMatch(toDiscoveredCompany(company), industry);
}

export function scoreCompanyTypeFactor(
  company: LeadScoringInput["company"],
  industry: string
): number {
  if (!industry) return 1;
  const result = companyMatchesIndustry(
    {
      name: company.name,
      domain: company.domain,
      industry: company.industry,
      description: company.description,
      websiteUrl: company.websiteUrl,
    },
    industry
  );
  if (result.conflictingIndustry) return 0;
  return result.matches ? 1 : 0.2;
}

export function scoreCompanySizeFactor(
  company: LeadScoringInput["company"],
  min: number | null,
  max: number | null
): number {
  if (min === null && max === null) return 1;
  if (company.employeeCount === null) return 0.45;
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

export function computeLeadScore(
  factors: LeadScoreFactors,
  weights: LeadScoringWeights = DEFAULT_LEAD_SCORING_WEIGHTS
): number {
  const totalWeight =
    weights.industryMatch +
    weights.companyTypeVerified +
    weights.companySize +
    weights.locationMatch +
    weights.jobRoleMatch +
    weights.technologyMatch;

  if (totalWeight === 0) return 1;

  const weightedSum =
    factors.industryMatch * weights.industryMatch +
    factors.companyTypeVerified * weights.companyTypeVerified +
    factors.companySize * weights.companySize +
    factors.locationMatch * weights.locationMatch +
    factors.jobRoleMatch * weights.jobRoleMatch +
    factors.technologyMatch * weights.technologyMatch;

  const average = weightedSum / totalWeight;
  return Math.max(1, Math.min(10, Math.round(1 + average * 9)));
}

export function scoreLead(
  input: LeadScoringInput,
  criteria: SearchScoringCriteria,
  weights: LeadScoringWeights = DEFAULT_LEAD_SCORING_WEIGHTS,
  contactDetailType?: import("@/types/lead").ContactDetailType
): ScoredLeadResult {
  const companyTypeVerified = scoreCompanyTypeFactor(input.company, criteria.industry);

  const factors: LeadScoreFactors = {
    industryMatch: scoreIndustryFactor(input.company, criteria.industry),
    companyTypeVerified,
    companySize: scoreCompanySizeFactor(
      input.company,
      criteria.companySizeMin,
      criteria.companySizeMax
    ),
    locationMatch: scoreLocationFactor(input.company, criteria.country),
    jobRoleMatch: scoreJobRoleFactor(input.role, criteria.jobTitles),
    technologyMatch: scoreTechnologyFactor(input.company, criteria.technologies),
  };

  const confidenceScore = computeLeadConfidence({
    title: input.role,
    titleRelevanceScore: scoreTitleRelevance(input.role, criteria.jobTitles),
    email: input.email,
    emailSource: input.emailSource,
    linkedinUrl: input.linkedinUrl,
    linkedInSource: input.linkedInSource,
    emailDisplayStatus: input.emailDisplayStatus,
    intentScore: input.intentScore,
    company: {
      name: input.company.name,
      industry: input.company.industry,
      description: input.company.description,
      domain: input.company.domain,
    },
    targetIndustry: criteria.industry,
  });

  const baseScore = computeLeadScore(factors, weights);
  const intentBoost =
    (input.intentScore ?? 0) >= 70 ? 1 : (input.intentScore ?? 0) >= 45 ? 0.5 : 0;
  const score = Math.min(10, Math.round((baseScore + intentBoost) * 10) / 10);

  const quality = computeLeadQualityBreakdown(input, criteria, contactDetailType);

  return {
    contactId: input.contactId,
    score,
    confidenceScore,
    factors,
    scoredAt: new Date().toISOString(),
    intentScore: input.intentScore ?? null,
    overallScore: quality.overallScore,
    companyScore: quality.companyScore,
    personScore: quality.personScore,
    contactScore: quality.contactScore,
    qualityCategory: quality.category,
  };
}

export function scoreLeads(
  inputs: LeadScoringInput[],
  criteria: SearchScoringCriteria,
  weights: LeadScoringWeights = DEFAULT_LEAD_SCORING_WEIGHTS
): { results: ScoredLeadResult[]; averageScore: number } {
  const results = inputs.map((input) => scoreLead(input, criteria, weights));
  const averageScore =
    results.length > 0
      ? Math.round(
          (results.reduce((sum, result) => sum + result.overallScore, 0) /
            results.length) *
            10
        ) / 10
      : 0;

  return { results, averageScore };
}
