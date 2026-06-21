export type SearchStatus = "draft" | "active" | "completed";

export interface SearchExclusions {
  domains: string[];
  industries: string[];
  keywords: string[];
  countries: string[];
}

export interface SearchCriteria {
  name: string;
  industry: string;
  companySizeMin: number | null;
  companySizeMax: number | null;
  country: string;
  keywords: string[];
  technologies: string[];
  jobTitles: string[];
  exclusions: SearchExclusions;
}

export interface SearchCriteriaInput {
  name: string;
  industry: string;
  companySizeMin: string;
  companySizeMax: string;
  country: string;
  keywords: string;
  technologies: string;
  jobTitles: string;
  excludeDomains: string;
  excludeIndustries: string;
  excludeKeywords: string;
  excludeCountries: string;
}

export interface SearchRecord extends SearchCriteria {
  id: string;
  userId: string;
  status: SearchStatus;
  createdAt: string;
  updatedAt: string;
}
