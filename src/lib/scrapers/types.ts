import type { FundingStage } from "@/lib/scraping/funding-stage";
import type { CompanySource } from "@/lib/company-discovery/company-verification";
import type { DiscoveredCompany } from "@/types/company";
import type { ScraperFilters } from "@/lib/scrapers/filters";

export type { ScraperFilters } from "@/lib/scrapers/filters";

/** Supported directory source identifiers. Add new sources here only. */
export const SCRAPER_SOURCE_IDS = [
  // Venture-backed startup sources (accelerators, incubators, startup directories)
  "ycombinator",
  "techstars",
  "500global",
  "antler",
  "f6s",
  "openvc",
  "seedtable",
  // Venture-capital firm portfolios (each stamps its firm as the investor)
  "sequoia-portfolio",
  "a16z-portfolio",
  "accel-portfolio",
  "lightspeed-portfolio",
  "general-catalyst-portfolio",
  "bessemer-portfolio",
  "index-ventures-portfolio",
  // General directories — kept registered but EXCLUDED from venture-backed discovery
  "producthunt",
  "betalist",
  "indiehackers",
  "startupranking",
  "saashub",
  "github-organizations",
] as const;

export type ScraperSourceId = (typeof SCRAPER_SOURCE_IDS)[number];

export type ScraperJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "stopped";

export interface ScraperSocialLinks {
  linkedin?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  github?: string | null;
  crunchbase?: string | null;
  productHunt?: string | null;
}

export interface ScraperFounder {
  name: string;
  title?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}

export interface ScraperWebsiteExtras {
  technologies?: string[];
  products?: string[];
  customerSegments?: string[];
  pricingPageUrl?: string | null;
  demoUrl?: string | null;
  documentationUrl?: string | null;
  blogUrl?: string | null;
}

/** Rich profile collected from a directory + optional official website. */
export interface ScrapedCompanyProfile {
  source: ScraperSourceId;
  sourceUrl: string;
  sourceCompanyId: string;
  name: string;
  websiteUrl: string | null;
  domain: string | null;
  description: string | null;
  industry: string | null;
  category: string | null;
  tags: string[];
  country: string | null;
  city: string | null;
  state: string | null;
  founders: ScraperFounder[];
  publicEmail: string | null;
  publicPhone: string | null;
  contactPageUrl: string | null;
  careersPageUrl: string | null;
  socialLinks: ScraperSocialLinks;
  fundingStage: FundingStage | null;
  /**
   * Known backers/investors. A scraper may set this from a portfolio/investor
   * page; the engine additionally stamps the source's inherent backer (e.g. a16z
   * portfolio ⇒ "Andreessen Horowitz") from the source catalog. Optional on the
   * scraped literal — guaranteed present (possibly []) by the time it flows on.
   */
  investors?: string[];
  teamSize: number | null;
  launchDate: string | null;
  websiteExtras: ScraperWebsiteExtras;

  /**
   * Accelerator/VC-portfolio detail. Optional so the general-directory sources
   * (Product Hunt, BetaList, …) that cannot supply these stay valid unchanged;
   * accelerator and portfolio sources populate what their listing publishes.
   */
  /** Cohort label as published, e.g. "Winter 2024". */
  batch?: string | null;
  /** active | acquired | ipo | exited | inactive, as the source reports it. */
  portfolioStatus?: string | null;
  foundedYear?: number | null;
  /** As published ("$12M"); kept as text since sources disagree on units. */
  totalFunding?: string | null;
  logoUrl?: string | null;
  /** Every published role inbox; `publicEmail` stays the primary one. */
  publicEmails?: string[];
  publicPhones?: string[];

  scrapedAt: string;
  errors: string[];
}

export interface ScraperListingSeed {
  sourceCompanyId: string;
  profileUrl: string;
  name?: string | null;
}

export interface ScraperRunOptions {
  maxCompanies?: number;
  maxPages?: number;
  enrichFromWebsite?: boolean;
  concurrency?: number;
  respectRobots?: boolean;
  minIntervalMs?: number;
}

export interface ScraperProgressEvent {
  source: ScraperSourceId;
  phase: string;
  current?: number;
  total?: number;
  label?: string;
}

export interface ScraperSourceReport {
  source: ScraperSourceId;
  startedAt: string;
  completedAt: string | null;
  companiesFound: number;
  companiesSaved: number;
  /** Profiles dropped because they did not match the requested search filters. */
  filteredCount: number;
  duplicateCount: number;
  errorCount: number;
  failedUrls: string[];
  errors: string[];
}

export interface ScraperRunReport {
  jobId: string;
  sources: ScraperSourceReport[];
  totalFound: number;
  totalSaved: number;
  totalFiltered: number;
  totalDuplicates: number;
  totalErrors: number;
  startedAt: string;
  completedAt: string | null;
}

export interface ScraperRunContext {
  userId: string;
  searchId: string | null;
  jobId: string;
  options: Required<ScraperRunOptions>;
  /** Search filters for this run; sources may use them for server-side narrowing. */
  filters: ScraperFilters;
  signal: AbortSignal;
  onProgress?: (event: ScraperProgressEvent) => void;
}

export interface ScraperEngineResult {
  companies: DiscoveredCompany[];
  profiles: ScrapedCompanyProfile[];
  report: ScraperRunReport;
}

export interface DirectoryProfilePayload {
  source: ScraperSourceId;
  sourceUrl: string;
  category: string | null;
  tags: string[];
  founders: ScraperFounder[];
  publicEmail: string | null;
  publicPhone: string | null;
  contactPageUrl: string | null;
  careersPageUrl: string | null;
  socialLinks: ScraperSocialLinks;
  fundingStage: FundingStage | null;
  investors: string[];
  teamSize: number | null;
  launchDate: string | null;
  websiteExtras: ScraperWebsiteExtras;
  sources: CompanySource[];
}
