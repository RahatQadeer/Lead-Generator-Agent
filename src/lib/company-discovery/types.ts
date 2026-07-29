import type {
  CompanyDiscoveryParams,
  CompanyDiscoveryPagination,
  DiscoveredCompany,
} from "@/types/company";

import type { RejectedCompanyView } from "@/lib/company-discovery/validate-company";
import type { ProgressReporter } from "@/lib/sse/stream";

/** Optional per-search context — e.g. a progress reporter for SSE streaming. */
export interface CompanyDiscoveryContext {
  onProgress?: ProgressReporter;
}

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
  search(
    params: CompanyDiscoveryParams,
    ctx?: CompanyDiscoveryContext
  ): Promise<ProviderSearchResult>;
}
