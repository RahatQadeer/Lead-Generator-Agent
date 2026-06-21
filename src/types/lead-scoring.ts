export interface LeadScoreFactors extends Record<string, number> {
  industryMatch: number;
  companySize: number;
  locationMatch: number;
  jobRoleMatch: number;
  technologyMatch: number;
}

export interface LeadScoringCompany {
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  country: string | null;
  websiteUrl: string | null;
  technologies: string[];
}

export interface LeadScoringInput {
  contactId: string;
  role: string;
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
  score: number;
  factors: LeadScoreFactors;
  scoredAt: string;
}

export interface LeadScoringBatchResult {
  results: ScoredLeadResult[];
  scoredCount: number;
  averageScore: number;
}
