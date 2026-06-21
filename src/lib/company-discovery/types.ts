import type {
  CompanyDiscoveryParams,
  CompanyDiscoveryPagination,
  DiscoveredCompany,
} from "@/types/company";

import type { RejectedCompanyView } from "@/lib/company-discovery/validate-company";

export interface ProviderSearchResult {
  companies: DiscoveredCompany[];
  pagination: CompanyDiscoveryPagination;
  rejected?: RejectedCompanyView[];
  /** Raw counts before pagination — for empty-state diagnostics. */
  stats?: {
    seedCount: number;
    enrichedCount: number;
    filteredCount?: number;
    rejectedCount?: number;
    relaxedMatch?: boolean;
  };
}

export interface CompanyDiscoveryProvider {
  readonly name: string;
  search(params: CompanyDiscoveryParams): Promise<ProviderSearchResult>;
}
