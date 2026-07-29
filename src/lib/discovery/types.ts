/**
 * The common company-source contract.
 *
 * Two scraper families exist in this codebase and neither is being rewritten:
 *
 *   - "seed" scrapers (src/lib/scrapers/sources/*) are PULL and two-phase:
 *     `collectListingSeeds()` returns profile URLs, then `scrapeCompanyProfile()`
 *     is called per seed.
 *   - "streaming" scrapers (the standalone directory engine) are PUSH: a single
 *     `produce(ctx)` call discovers companies and hands each one to `ctx.emit()`,
 *     carrying its own resume cursor and detail-page queue.
 *
 * An async stream is the only shape both map onto without changing either. A
 * pull source yields per seed; a push source bridges `emit` into the stream.
 * Streaming also means the pipeline sees companies as they are found rather than
 * after a source finishes, so progress is live, memory stays flat on a 6,000-row
 * directory, and a `limit` stops work instead of discarding it.
 *
 * The record type is deliberately the EXISTING `ScrapedCompanyProfile`, so every
 * scraper already conforms at the data level and no mapping layer is introduced.
 */
import type {
  ScrapedCompanyProfile,
  ScraperFilters,
  ScraperProgressEvent,
  ScraperRunOptions,
} from "@/lib/scrapers/types";

/**
 * How a source is classified. Discovery targets venture-backed sources; general
 * directories stay registered but are excluded from venture-backed searches.
 */
export type SourceKind =
  | "accelerator"
  | "vc-portfolio"
  | "startup-directory"
  | "general-directory";

/** Everything a source needs to run one scrape, and nothing more. */
export interface ScrapeRunContext {
  readonly jobId: string;
  /** Search filters; a source may use them to narrow server-side. */
  readonly filters: ScraperFilters;
  /** Stop after this many companies. 0 = unlimited. */
  readonly limit: number;
  readonly options: Required<ScraperRunOptions>;
  /** Aborted when the user stops the job; sources must observe it. */
  readonly signal: AbortSignal;
  onProgress?: (event: ScraperProgressEvent) => void;
}

/**
 * A registered company source.
 *
 * Implementations are produced by the adapters in `./adapters` — concrete
 * scrapers are never expected to implement this by hand.
 */
export interface CompanyScraper {
  /** Stable id; also the value written to `source` on discovered companies. */
  readonly id: string;
  readonly displayName: string;
  readonly kind: SourceKind;
  /**
   * Investors inherent to the source: a VC portfolio implies the firm, an
   * accelerator implies the programme. Stamped onto every company it yields.
   */
  readonly backers: readonly string[];

  /**
   * Optional pre-flight: return false to skip this source entirely for a given
   * search. Lets a country- or industry-specific source opt out cheaply instead
   * of scraping and filtering afterwards.
   */
  supports?(filters: ScraperFilters): boolean;

  /**
   * Yield companies as they are discovered.
   *
   * Must stop promptly when `ctx.signal` aborts. Throwing aborts only this
   * source — the pipeline records the failure and continues with the others.
   */
  scrape(ctx: ScrapeRunContext): AsyncIterable<ScrapedCompanyProfile>;
}

/** Static description used to list sources without constructing them. */
export interface CompanyScraperInfo {
  id: string;
  displayName: string;
  kind: SourceKind;
  backers: readonly string[];
  /** Set when a source is known to block automation or forbid it in its ToS. */
  restricted?: boolean;
}
