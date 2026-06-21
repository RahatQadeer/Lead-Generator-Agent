import { companyMatchesIndustry } from "@/lib/scraping/industry-classifier";
import type { EmailDisplayStatus } from "@/types/email-verification";
import type { EmailSource, LinkedInSource } from "@/types/lead";

export interface LeadConfidenceInput {
  title: string;
  titleRelevanceScore: number;
  email: string | null;
  emailSource: EmailSource;
  linkedinUrl: string | null;
  linkedInSource: LinkedInSource;
  emailDisplayStatus?: EmailDisplayStatus | null;
  company: {
    name: string;
    industry: string | null;
    description?: string | null;
    domain?: string | null;
  };
  targetIndustry: string;
  intentScore?: number | null;
}

/**
 * Overall lead confidence 0–100 based on data quality and fit.
 */
export function computeLeadConfidence(input: LeadConfidenceInput): number {
  let score = Math.round(input.titleRelevanceScore * 0.35);

  if (input.email && input.emailSource === "found") {
    score += 28;
  }

  if (input.linkedinUrl) {
    if (input.linkedInSource === "website") score += 18;
    else if (input.linkedInSource === "public_profile") score += 12;
  }

  const industry = companyMatchesIndustry(
    {
      name: input.company.name,
      industry: input.company.industry,
      description: input.company.description,
      domain: input.company.domain,
    },
    input.targetIndustry
  );
  if (industry.matches) score += Math.round(industry.score * 15);
  else if (industry.conflictingIndustry) score -= 20;

  if (input.emailDisplayStatus === "verified") score += 15;
  else if (input.emailDisplayStatus === "likely_valid") score += 8;
  else if (input.emailDisplayStatus === "invalid") score -= 10;

  if ((input.intentScore ?? 0) >= 70) score += 12;
  else if ((input.intentScore ?? 0) >= 40) score += 6;

  return Math.max(0, Math.min(100, Math.round(score)));
}
