export interface ContactDiscoveryTargetCompany {
  id: string;
  name: string;
  domain: string | null;
  providerCompanyId: string | null;
}

export interface DiscoveredContact {
  id: string;
  companyId: string;
  companyName: string;
  companyDomain: string | null;
  firstName: string;
  lastName: string | null;
  fullName: string;
  title: string;
  department: string | null;
  email: string | null;
  emailIsGuessed: boolean;
  linkedinUrl: string | null;
  confidenceScore: number;
  sourceUrl?: string | null;
  discoverySource?: "website_team" | "linkedin_search" | "wikidata" | "directory_listing" | "domain_search" | null;
  /** False when returned as an alternative decision-maker because the selected title was not found. */
  titleMatched?: boolean;
  /** Raw page context used to infer titles when the parser only captured a name. */
  titleContext?: string | null;
}

export interface ContactDiscoveryParams {
  jobTitles: string[];
  companies: ContactDiscoveryTargetCompany[];
  page: number;
  perPage: number;
}

export interface ContactDiscoveryPagination {
  page: number;
  perPage: number;
  totalEntries: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ContactDiscoveryResult {
  contacts: DiscoveredContact[];
  pagination: ContactDiscoveryPagination;
  provider: string;
  /** People matching job titles after filtering. */
  scrapedCount: number;
  /** Raw people parsed from websites before job-title filtering. */
  parsedCount: number;
  filteredCount: number;
  rejectedCount: number;
  duplicateCount: number;
  batchDuplicateCount: number;
  knownDuplicateCount: number;
  relaxedMatch?: boolean;
  companiesWithContacts?: number;
}

export interface DiscoverContactsOptions {
  knownDedupKeys?: ReadonlySet<string>;
}
