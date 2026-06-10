import type {
  ContactDiscoveryPagination,
  ContactDiscoveryParams,
  DiscoveredContact,
} from "@/types/contact";

export interface ProviderContactSearchResult {
  contacts: DiscoveredContact[];
  pagination: ContactDiscoveryPagination;
}

export interface ContactDiscoveryProvider {
  readonly name: string;
  search(params: ContactDiscoveryParams): Promise<ProviderContactSearchResult>;
}
