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
  email: string | null;
  linkedinUrl: string | null;
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
  filteredCount: number;
  duplicateCount: number;
  batchDuplicateCount: number;
  knownDuplicateCount: number;
}

export interface DiscoverContactsOptions {
  knownDedupKeys?: ReadonlySet<string>;
}
