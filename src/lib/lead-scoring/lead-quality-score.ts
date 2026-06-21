import { matchesJobTitle } from "@/lib/contact-discovery/apply-title-filter";
import {
  matchesCountry,
  matchesSize,
  scoreIndustryMatch,
} from "@/lib/company-discovery/apply-criteria-helpers";
import { classifyContactQuality } from "@/lib/scraping/data-quality";
import { scoreTitleRelevance } from "@/lib/scraping/relevance";
import type { EmailDisplayStatus } from "@/types/email-verification";
import type { ContactDetailType, EmailSource, LinkedInSource } from "@/types/lead";
import type { LeadScoringInput, SearchScoringCriteria } from "@/types/lead-scoring";

export type LeadQualityCategory = "excellent" | "good" | "average" | "reject";

export interface LeadQualityBreakdown {
  companyScore: number;
  personScore: number;
  contactScore: number;
  overallScore: number;
  category: LeadQualityCategory;
}

export function scoreToCategory(score: number): LeadQualityCategory {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 50) return "average";
  return "reject";
}

function computeCompanyScore(
  company: LeadScoringInput["company"],
  criteria: SearchScoringCriteria
): number {
  const discovered = {
    id: "score",
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

  const industry = scoreIndustryMatch(discovered, criteria.industry);
  const location = criteria.country
    ? matchesCountry(discovered, criteria.country)
      ? 1
      : 0
    : 1;
  const size =
    criteria.companySizeMin === null && criteria.companySizeMax === null
      ? 1
      : company.employeeCount === null
        ? 0.4
        : matchesSize(discovered, criteria.companySizeMin, criteria.companySizeMax)
          ? 1
          : 0;

  const score = industry * 0.5 + location * 0.3 + size * 0.2;
  return Math.round(score * 100);
}

function computePersonScore(role: string, jobTitles: string[]): number {
  const relevance = scoreTitleRelevance(role, jobTitles);
  const matches = jobTitles.length === 0 || matchesJobTitle(role, jobTitles);
  const matchBonus = matches ? 1 : 0.2;
  return Math.round(relevance * 0.7 * matchBonus + (matches ? 30 : 0));
}

function computeContactScore(input: {
  email: string | null;
  emailSource: EmailSource;
  linkedinUrl: string | null;
  linkedInSource: LinkedInSource;
  emailDisplayStatus?: EmailDisplayStatus | null;
  contactDetailType?: ContactDetailType;
}): number {
  let score = 0;

  const tier = classifyContactQuality({
    email: input.email,
    linkedinUrl: input.linkedinUrl,
  });

  if (input.emailDisplayStatus === "verified") score += 55;
  else if (input.emailDisplayStatus === "likely_valid") score += 40;
  else if (input.email && input.emailSource === "found") {
    if (tier === "high") score += 45;
    else if (tier === "low") score += 8;
    else if (input.contactDetailType === "public_email") score += 12;
    else score += 20;
  } else if (input.emailDisplayStatus === "invalid") score += 0;

  if (input.linkedinUrl) {
    score += tier === "medium" && !input.email ? 28 : input.linkedInSource === "website" ? 22 : 18;
  }

  if (input.contactDetailType === "contact_page_only") {
    score = Math.max(score, 15);
  }

  return Math.min(100, score);
}

export function computeLeadQualityBreakdown(
  input: LeadScoringInput,
  criteria: SearchScoringCriteria,
  contactDetailType?: ContactDetailType
): LeadQualityBreakdown {
  const companyScore = computeCompanyScore(input.company, criteria);
  const personScore = computePersonScore(input.role, criteria.jobTitles);
  const contactScore = computeContactScore({
    email: input.email,
    emailSource: input.emailSource,
    linkedinUrl: input.linkedinUrl,
    linkedInSource: input.linkedInSource,
    emailDisplayStatus: input.emailDisplayStatus,
    contactDetailType,
  });

  const intentBoost =
    (input.intentScore ?? 0) >= 70 ? 8 : (input.intentScore ?? 0) >= 40 ? 4 : 0;

  const overallScore = Math.min(
    100,
    Math.round(companyScore * 0.35 + personScore * 0.3 + contactScore * 0.35 + intentBoost)
  );

  return {
    companyScore,
    personScore,
    contactScore,
    overallScore,
    category: scoreToCategory(overallScore),
  };
}
