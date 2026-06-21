import type { SearchExclusions } from "@/types/search";

export interface DiscoveredCompany {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  description: string | null;
  employeeCount: number | null;
  country: string | null;
  city: string | null;
  state: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  technologies: string[] | null;
  confidenceScore: number;
}

export interface CompanyDiscoveryParams {
  searchName?: string;
  industry: string;
  country: string;
  companySizeMin: number | null;
  companySizeMax: number | null;
  keywords: string[];
  technologies: string[];
  exclusions: SearchExclusions;
  page: number;
  perPage: number;
}

export interface CompanyDiscoveryPagination {
  page: number;
  perPage: number;
  totalEntries: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CompanyDiscoveryResult {
  companies: DiscoveredCompany[];
  pagination: CompanyDiscoveryPagination;
  provider: string;
  filteredCount: number;
  excludedCount: number;
  duplicateCount: number;
  batchDuplicateCount: number;
  knownDuplicateCount: number;
  seedCount?: number;
  enrichedCount?: number;
  relaxedMatch?: boolean;
  rejected?: import("@/lib/company-discovery/validate-company").RejectedCompanyView[];
}

export interface DiscoverCompaniesOptions {
  knownDedupKeys?: ReadonlySet<string>;
}
