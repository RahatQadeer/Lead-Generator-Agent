import type {
  ContactDiscoveryPagination,
  ContactDiscoveryParams,
  DiscoveredContact,
} from "@/types/contact";

export interface ProviderContactSearchResult {
  contacts: DiscoveredContact[];
  pagination: ContactDiscoveryPagination;
  /** People matching job titles after filtering. */
  scrapedCount?: number;
  /** Raw people parsed from websites before job-title filtering. */
  parsedCount?: number;
  /** People removed because their title didn't match the search. */
  filteredCount?: number;
  /** People parsed but rejected (affiliation, junk name, low confidence). */
  rejectedCount?: number;
  /** True when results use website decision-makers instead of exact title matches. */
  relaxedMatch?: boolean;
  /** Companies that returned at least one person. */
  companiesWithContacts?: number;
}

export interface ContactDiscoveryProvider {
  readonly name: string;
  search(params: ContactDiscoveryParams): Promise<ProviderContactSearchResult>;
}
