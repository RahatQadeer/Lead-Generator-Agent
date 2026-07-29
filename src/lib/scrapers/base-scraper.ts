import { createLogger } from "@/lib/logger";
import { isRestrictedSource, isRestrictedSourceEnabled } from "@/lib/scrapers/source-policy";
import type {
  ScraperListingSeed,
  ScraperRunContext,
  ScraperRunOptions,
  ScraperSourceId,
  ScrapedCompanyProfile,
} from "@/lib/scrapers/types";

const log = createLogger("scrapers.base");

export const DEFAULT_SCRAPER_OPTIONS: Required<ScraperRunOptions> = {
  maxCompanies: 100,
  maxPages: 10,
  enrichFromWebsite: true,
  concurrency: 3,
  respectRobots: true,
  minIntervalMs: 1_200,
};

export abstract class BaseScraper {
  abstract readonly sourceId: ScraperSourceId;
  abstract readonly displayName: string;
  abstract readonly baseUrl: string;

  protected resolveOptions(
    options: ScraperRunOptions = {}
  ): Required<ScraperRunOptions> {
    return {
      ...DEFAULT_SCRAPER_OPTIONS,
      ...options,
    };
  }

  protected logInfo(message: string, meta?: Record<string, unknown>): void {
    log.info(message, { source: this.sourceId, ...meta });
  }

  protected logWarn(message: string, meta?: Record<string, unknown>): void {
    log.warn(message, { source: this.sourceId, ...meta });
  }

  protected throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new Error(`Scraper stopped for ${this.sourceId}`);
    }
  }

  protected reportProgress(
    ctx: ScraperRunContext,
    phase: string,
    meta?: { current?: number; total?: number; label?: string }
  ): void {
    ctx.onProgress?.({
      source: this.sourceId,
      phase,
      ...meta,
    });
  }

  /** Collect listing seeds (profile URLs) from the directory. */
  abstract collectListingSeeds(
    ctx: ScraperRunContext,
    options: Required<ScraperRunOptions>
  ): Promise<ScraperListingSeed[]>;

  /** Scrape a single company profile page from the directory. */
  abstract scrapeCompanyProfile(
    seed: ScraperListingSeed,
    ctx: ScraperRunContext,
    options: Required<ScraperRunOptions>
  ): Promise<ScrapedCompanyProfile | null>;

  async run(
    ctx: ScraperRunContext,
    options: ScraperRunOptions = {}
  ): Promise<ScrapedCompanyProfile[]> {
    const resolved = this.resolveOptions(options);

    // Opt-in gate: Cloudflare/anti-bot or ToS-restricted sources stay off unless
    // explicitly enabled via SCRAPER_ENABLE_RESTRICTED. Returns empty gracefully.
    if (isRestrictedSource(this.sourceId) && !isRestrictedSourceEnabled(this.sourceId)) {
      this.logWarn(
        "Source is restricted and disabled by default — set SCRAPER_ENABLE_RESTRICTED to opt in",
        { source: this.sourceId }
      );
      return [];
    }

    this.logInfo("Starting directory scrape", { jobId: ctx.jobId, options: resolved });

    this.reportProgress(ctx, `Collecting ${this.displayName} listings…`);
    const seeds = await this.collectListingSeeds(ctx, resolved);
    this.throwIfAborted(ctx.signal);

    const limitedSeeds = seeds.slice(0, resolved.maxCompanies);
    this.logInfo("Listing seeds collected", {
      total: seeds.length,
      processing: limitedSeeds.length,
    });

    const pLimit = (await import("p-limit")).default;
    const limit = pLimit(resolved.concurrency);
    const profiles: ScrapedCompanyProfile[] = [];
    const failedUrls: string[] = [];
    let processed = 0;

    await Promise.all(
      limitedSeeds.map((seed) =>
        limit(async () => {
          this.throwIfAborted(ctx.signal);
          processed += 1;
          this.reportProgress(ctx, `Scraping ${this.displayName} profiles…`, {
            current: processed,
            total: limitedSeeds.length,
            label: seed.name ?? seed.profileUrl,
          });

          try {
            const profile = await this.scrapeCompanyProfile(seed, ctx, resolved);
            if (profile) {
              profiles.push(profile);
            }
          } catch (error) {
            failedUrls.push(seed.profileUrl);
            this.logWarn("Failed to scrape company profile", {
              url: seed.profileUrl,
              error: String(error),
            });
          }
        })
      )
    );

    if (failedUrls.length > 0) {
      this.logWarn("Profile scrape failures", { count: failedUrls.length });
    }

    return profiles;
  }
}
