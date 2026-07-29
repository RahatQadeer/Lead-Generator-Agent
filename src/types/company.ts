import type { SearchExclusions } from "@/types/search";
import type { WebsiteStatus } from "@/lib/scraping/website-verification";
import type {
  CompanySource,
  CompanyValidationStatus,
} from "@/lib/company-discovery/company-verification";

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
  /** Liveness verdict for the company website (undefined until verified). */
  websiteStatus?: WebsiteStatus | null;
  /** 0-100 website quality rating (About/Contact/products + content depth). */
  qualityScore?: number | null;
  /** 0-100 deterministic semantic match between the search and the company. */
  semanticRelevance?: number | null;
  /** Trusted sources that corroborate the company (>=2 = cross-verified). */
  sources?: CompanySource[];
  /** Final verification verdict: verified / needs_verification / rejected. */
  validationStatus?: CompanyValidationStatus;
  /** Human-readable reasons a company is not fully verified. */
  validationReasons?: string[];
  /** Detected org type — set for investor searches so VCs can be labeled, not just filtered. */
  companyType?: import("@/lib/scraping/company-type").CompanyType | null;
  /** "Venture capital" / "Accelerator" / "Investment firm"; null for operating companies. */
  vcCategory?: string | null;
  /** Best-effort startup funding stage from public text; null means unknown, not bootstrapped. */
  fundingStage?: import("@/lib/scraping/funding-stage").FundingStage | null;
  /** Publicly listed leadership (founders/CEO/CTO/…) when discovered via a directory scraper. */
  founders?: import("@/lib/scrapers/types").ScraperFounder[];
  /** Full directory-scrape payload (socials, contact/careers pages, founders) persisted to companies.directory_profile. */
  directoryProfile?: import("@/lib/scrapers/types").DirectoryProfilePayload | null;
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
  /** Optional progress reporter for SSE streaming of long discovery runs. */
  onProgress?: import("@/lib/sse/stream").ProgressReporter;
  /** Owner of the run — threaded to the directory scraper source for logging/robots UA. */
  userId?: string;
  /** Search being populated — lets the directory scraper tag its run. */
  searchId?: string | null;
}
