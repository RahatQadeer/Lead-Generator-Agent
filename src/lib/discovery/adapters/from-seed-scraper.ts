/**
 * Adapt a two-phase "seed" scraper (src/lib/scrapers/base-scraper.ts) to the
 * {@link CompanyScraper} stream contract.
 *
 * The concrete sources are NOT modified. This drives their two public methods
 * directly — `collectListingSeeds` then `scrapeCompanyProfile` per seed — rather
 * than going through `BaseScraper.run()`, for two reasons:
 *
 *   1. `run()` buffers every profile into an array and returns only when the
 *      whole source is finished. Streaming lets the pipeline enrich and persist
 *      companies while later pages are still being fetched.
 *   2. `run()` applies `maxCompanies` to SEEDS. A source whose profile pages
 *      partly fail then returns fewer companies than asked for. Counting yielded
 *      companies instead makes `limit` mean what it says.
 *
 * Concurrency is preserved: profiles are fetched `options.concurrency` at a time
 * through a sliding window, and yielded in completion order.
 */
import type { BaseScraper } from "@/lib/scrapers/base-scraper";
import { DEFAULT_SCRAPER_OPTIONS } from "@/lib/scrapers/base-scraper";
import { isRestrictedSource, isRestrictedSourceEnabled } from "@/lib/scrapers/source-policy";
import { getSourceBackers, getSourceCategory } from "@/lib/scrapers/source-catalog";
import type {
  ScrapedCompanyProfile,
  ScraperFilters,
  ScraperListingSeed,
} from "@/lib/scrapers/types";
import { createLogger } from "@/lib/logger";
import type { CompanyScraper, ScrapeRunContext, SourceKind } from "@/lib/discovery/types";

const log = createLogger("discovery.adapter.seed");

export interface SeedScraperAdapterOptions {
  /** Override the source classification; defaults to the source catalog. */
  kind?: SourceKind;
  /** Override inherent backers; defaults to the source catalog. */
  backers?: readonly string[];
  supports?: (filters: ScraperFilters) => boolean;
}

/**
 * Run `tasks` with at most `concurrency` in flight, yielding each result as it
 * settles.
 *
 * Written as a sliding window rather than fixed batches: a batch would idle the
 * whole window on one slow profile page, which is the common case when a source
 * mixes cached and cold pages.
 */
async function* streamConcurrently<T, R>(
  items: readonly T[],
  concurrency: number,
  signal: AbortSignal,
  run: (item: T, index: number) => Promise<R>
): AsyncGenerator<R> {
  const width = Math.max(1, concurrency);
  const inFlight = new Map<number, Promise<{ key: number; value: R }>>();
  let next = 0;

  const start = (index: number): void => {
    const promise = run(items[index] as T, index).then((value) => ({
      key: index,
      value,
    }));
    inFlight.set(index, promise);
  };

  while (next < items.length && inFlight.size < width) start(next++);

  while (inFlight.size > 0) {
    if (signal.aborted) return;
    const { key, value } = await Promise.race(inFlight.values());
    inFlight.delete(key);
    yield value;
    if (next < items.length && !signal.aborted) start(next++);
  }
}

/**
 * Wrap a seed-scraper instance as a streaming {@link CompanyScraper}.
 *
 * `factory` is called once per run so each scrape gets a fresh instance — some
 * sources cache listing state on the instance, and reusing one across concurrent
 * jobs would leak results between them.
 */
export function fromSeedScraper(
  factory: () => BaseScraper,
  options: SeedScraperAdapterOptions = {}
): CompanyScraper {
  const probe = factory();
  const id = probe.sourceId;

  return {
    id,
    displayName: probe.displayName,
    kind: options.kind ?? getSourceCategory(id),
    backers: options.backers ?? getSourceBackers(id),

    supports: options.supports,

    async *scrape(ctx: ScrapeRunContext): AsyncIterable<ScrapedCompanyProfile> {
      // Anti-bot / ToS-restricted sources stay off unless explicitly enabled.
      // Matches the gate in BaseScraper.run(), which this path bypasses.
      if (isRestrictedSource(id) && !isRestrictedSourceEnabled(id)) {
        log.warn("Source is restricted and disabled by default — skipping", { source: id });
        return;
      }

      const scraper = factory();
      const resolved = { ...DEFAULT_SCRAPER_OPTIONS, ...ctx.options };

      // The legacy context shape the concrete sources expect, unchanged.
      const legacyCtx = {
        userId: "",
        searchId: null,
        jobId: ctx.jobId,
        options: resolved,
        filters: ctx.filters,
        signal: ctx.signal,
        onProgress: ctx.onProgress,
      };

      ctx.onProgress?.({
        source: id as never,
        phase: `Collecting ${probe.displayName} listings…`,
      });

      const seeds = await scraper.collectListingSeeds(legacyCtx, resolved);
      if (ctx.signal.aborted) return;

      // `limit` counts COMPANIES, not seeds, so do not slice the seed list to
      // the limit — profile failures would silently shrink the result. Seeds are
      // still capped generously to bound work on very large directories.
      const seedCap = ctx.limit > 0 ? Math.min(seeds.length, ctx.limit * 3) : seeds.length;
      const work = seeds.slice(0, Math.max(seedCap, resolved.maxCompanies));

      log.info("Listing seeds collected", {
        source: id,
        total: seeds.length,
        processing: work.length,
      });

      let yielded = 0;
      let processed = 0;
      const failures: string[] = [];

      const results = streamConcurrently(
        work,
        resolved.concurrency,
        ctx.signal,
        async (seed: ScraperListingSeed) => {
          try {
            return await scraper.scrapeCompanyProfile(seed, legacyCtx, resolved);
          } catch (error) {
            failures.push(seed.profileUrl);
            log.warn("Failed to scrape company profile", {
              source: id,
              url: seed.profileUrl,
              error: String(error),
            });
            return null;
          }
        }
      );

      for await (const profile of results) {
        processed += 1;
        ctx.onProgress?.({
          source: id as never,
          phase: `Scraping ${probe.displayName} profiles…`,
          current: processed,
          total: work.length,
        });

        if (!profile) continue;
        yield profile;

        yielded += 1;
        if (ctx.limit > 0 && yielded >= ctx.limit) break;
      }

      if (failures.length > 0) {
        log.warn("Profile scrape failures", { source: id, count: failures.length });
      }
    },
  };
}
