import type { EmailSource, LinkedInSource } from "@/types/lead";

export interface LeadScoreFactors extends Record<string, number> {
  industryMatch: number;
  companyTypeVerified: number;
  companySize: number;
  locationMatch: number;
  jobRoleMatch: number;
  technologyMatch: number;
}

export interface LeadScoringCompany {
  name: string;
  domain: string | null;
  industry: string | null;
  description: string | null;
  employeeCount: number | null;
  country: string | null;
  websiteUrl: string | null;
  technologies: string[];
}

export interface LeadScoringInput {
  contactId: string;
  role: string;
  email: string | null;
  emailSource: EmailSource;
  linkedinUrl: string | null;
  linkedInSource: LinkedInSource;
  emailDisplayStatus?: import("@/types/email-verification").EmailDisplayStatus | null;
  intentScore?: number | null;
  company: LeadScoringCompany;
}

export interface SearchScoringCriteria {
  industry: string;
  companySizeMin: number | null;
  companySizeMax: number | null;
  country: string;
  technologies: string[];
  jobTitles: string[];
}

export interface ScoredLeadResult {
  contactId: string;
  /** Legacy 1–10 ICP fit score */
  score: number;
  confidenceScore: number;
  factors: LeadScoreFactors;
  scoredAt: string;
  intentScore?: number | null;
  intentSignals?: import("@/types/intent-signals").IntentSignal[] | null;
  /** Apollo/Clay-style 0–100 quality breakdown */
  overallScore: number;
  companyScore: number;
  personScore: number;
  contactScore: number;
  qualityCategory: import("@/lib/lead-scoring/lead-quality-score").LeadQualityCategory;
}

export interface LeadScoringBatchResult {
  results: ScoredLeadResult[];
  scoredCount: number;
  averageScore: number;
}
