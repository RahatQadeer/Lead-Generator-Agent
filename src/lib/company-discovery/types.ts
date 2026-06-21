import type {
  CompanyDiscoveryParams,
  CompanyDiscoveryPagination,
  DiscoveredCompany,
} from "@/types/company";

export interface ProviderSearchResult {
  companies: DiscoveredCompany[];
  pagination: CompanyDiscoveryPagination;
}

export interface CompanyDiscoveryProvider {
  readonly name: string;
  search(params: CompanyDiscoveryParams): Promise<ProviderSearchResult>;
}
