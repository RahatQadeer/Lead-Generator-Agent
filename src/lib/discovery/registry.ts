/**
 * The company-source registry.
 *
 * One place maps a source id to a {@link CompanyScraper}. Adding a source is a
 * single entry here; the pipeline, the API routes and the UI all read from this
 * and never learn which scraper family a source belongs to.
 *
 * Sources are registered lazily (a thunk, not an instance) so that importing the
 * registry — which the API routes do on every request — does not construct 20+
 * scrapers, open HTTP clients, or read env for sources this run will not touch.
 */
import { SCRAPER_REGISTRY_ENTRIES } from "@/lib/scrapers/registry";
import { fromSeedScraper } from "@/lib/discovery/adapters/from-seed-scraper";
import type { CompanyScraper, CompanyScraperInfo } from "@/lib/discovery/types";
import { isRestrictedSource } from "@/lib/scrapers/source-policy";
import { isVentureBackedSource } from "@/lib/scrapers/source-catalog";
import type { ScraperSourceId } from "@/lib/scrapers/types";

type ScraperThunk = () => CompanyScraper;

/**
 * Built from the existing seed-scraper registry rather than duplicating it, so
 * the two can never drift. Streaming sources (the standalone directory engine)
 * register alongside these once ported — same map, same shape.
 */
const REGISTRY: Map<string, ScraperThunk> = new Map(
  SCRAPER_REGISTRY_ENTRIES.map(([id, Ctor]) => [
    id,
    () => fromSeedScraper(() => new Ctor()),
  ])
);

/** Register (or replace) a source. Used by the streaming-engine port and tests. */
export function registerCompanyScraper(id: string, thunk: ScraperThunk): void {
  REGISTRY.set(id, thunk);
}

export function hasCompanyScraper(id: string): boolean {
  return REGISTRY.has(id);
}

export function getCompanyScraper(id: string): CompanyScraper {
  const thunk = REGISTRY.get(id);
  if (!thunk) {
    throw new Error(
      `Unknown company source "${id}". Registered: ${listSourceIds().join(", ")}`
    );
  }
  return thunk();
}

export function listSourceIds(): string[] {
  return [...REGISTRY.keys()];
}

/**
 * Describe every registered source without constructing the scrapers that back
 * them — this powers the source picker in the search builder.
 */
export function listSources(): CompanyScraperInfo[] {
  return listSourceIds().map((id) => {
    const scraper = getCompanyScraper(id);
    return {
      id: scraper.id,
      displayName: scraper.displayName,
      kind: scraper.kind,
      backers: scraper.backers,
      restricted: isRestrictedSource(id as ScraperSourceId),
    };
  });
}

/**
 * The default source set for a venture-backed search: everything except general
 * directories (Product Hunt, BetaList, …), which list unfunded side projects and
 * would dilute the results.
 */
export function defaultSourceIds(): string[] {
  return listSourceIds().filter((id) =>
    isVentureBackedSource(id as ScraperSourceId)
  );
}

/** Resolve requested ids to scrapers, reporting the ones that do not exist. */
export function resolveSources(ids: readonly string[]): {
  scrapers: CompanyScraper[];
  unknown: string[];
} {
  const scrapers: CompanyScraper[] = [];
  const unknown: string[] = [];

  for (const id of ids) {
    if (hasCompanyScraper(id)) scrapers.push(getCompanyScraper(id));
    else unknown.push(id);
  }

  return { scrapers, unknown };
}
