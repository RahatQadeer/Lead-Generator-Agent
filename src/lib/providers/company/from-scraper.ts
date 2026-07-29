/**
 * Turn a registered {@link CompanyScraper} into a {@link CompanyProvider}.
 *
 * This is how the directory scrapers (Y Combinator, Techstars, Antler, 500
 * Global, the VC portfolio sources) stop being standalone scripts and become
 * ordinary providers: the pipeline sees them through exactly the same interface
 * as Google Places or Apollo, and none of them is modified to get there.
 *
 * Each source becomes its OWN provider rather than one "scrapers" provider
 * fronting all of them. That is what makes them individually enableable,
 * individually rate-limited (a shared limiter would let a fast source starve a
 * slow one), and individually reportable when one breaks.
 */
import { createLogger } from "@/lib/logger";
import { getCompanyScraper, listSourceIds } from "@/lib/discovery/registry";
import { DEFAULT_SCRAPER_OPTIONS } from "@/lib/scrapers/base-scraper";
import type { CompanyScraper } from "@/lib/discovery/types";
import type { ScrapedCompanyProfile, ScraperFilters } from "@/lib/scrapers/types";
import { registerProvider } from "@/lib/providers/registry";
import type {
  CompanyCriteria,
  CompanyProvider,
  ProviderContext,
} from "@/lib/providers/types";

const log = createLogger("providers.company.scraper");

/**
 * Translate provider-level criteria into the scrapers' filter shape.
 *
 * Deliberately not a cast: `ScraperFilters` calls the geography field `location`
 * (free text, token-matched) rather than `country`, and takes `fundingStage`
 * singular-or-array. An `as ScraperFilters` here compiles but drops the country
 * filter on the floor, which is exactly the kind of silent mismatch that makes a
 * search quietly return the wrong companies.
 */
function toScraperFilters(criteria: CompanyCriteria): ScraperFilters {
  return {
    industry: criteria.industry ?? null,
    category: criteria.category ?? null,
    // Scrapers token-match one free-text location; multi-country searches are
    // fanned out by the caller, so take the first and let the pipeline's own
    // country filter catch the rest.
    location: criteria.countries?.[0] ?? null,
    fundingStage: criteria.fundingStages?.length ? criteria.fundingStages : null,
    companySizeMin: criteria.companySizeMin ?? null,
    companySizeMax: criteria.companySizeMax ?? null,
    keywords: criteria.keywords?.length ? criteria.keywords : null,
  };
}

/**
 * Wrap one source.
 *
 * Directory scrapers are `free` tier and self-rate-limited (each owns its own
 * politeness delay against its host), so the provider declares a generous
 * concurrency and lets the scraper pace itself. Overriding here would double-
 * throttle and roughly halve throughput.
 */
export function companyProviderFromScraper(sourceId: string): CompanyProvider {
  const scraper: CompanyScraper = getCompanyScraper(sourceId);

  return {
    id: `scraper:${scraper.id}`,
    displayName: scraper.displayName,
    kind: "company",
    tier: "free",

    rateLimit: { requestsPerSecond: 50, burst: 50, maxConcurrent: 1 },

    isConfigured: () => true,

    async *discover(
      criteria: CompanyCriteria,
      ctx: ProviderContext
    ): AsyncIterable<ScrapedCompanyProfile> {
      const filters = toScraperFilters(criteria);

      if (scraper.supports && !scraper.supports(filters)) {
        log.debug("Source opted out of this search", { source: scraper.id });
        return;
      }

      const stream = scraper.scrape({
        jobId: ctx.jobId,
        filters,
        limit: criteria.limit ?? 0,
        options: { ...DEFAULT_SCRAPER_OPTIONS },
        signal: ctx.signal,
        onProgress: (event) =>
          ctx.onProgress?.({
            provider: scraper.id,
            phase: event.phase,
            current: event.current,
            total: event.total,
          }),
      });

      for await (const profile of stream) {
        if (ctx.signal.aborted) return;
        // Stamp the source's inherent backers so downstream scoring can treat
        // "in a16z's portfolio" as the funding signal it is.
        yield scraper.backers.length > 0
          ? { ...profile, investors: [...new Set([...(profile.investors ?? []), ...scraper.backers])] }
          : profile;
      }
    },
  };
}

/**
 * Register every directory source as its own company provider.
 *
 * Priority 10 — directory sources run before API providers because they are
 * free, precise about funding provenance, and produce the batch/investor
 * metadata the paid APIs do not.
 */
export function registerScraperCompanyProviders(): void {
  for (const sourceId of listSourceIds()) {
    registerProvider(
      `scraper:${sourceId}`,
      "company",
      () => companyProviderFromScraper(sourceId),
      { priority: 10 }
    );
  }
}
