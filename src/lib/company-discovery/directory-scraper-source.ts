import { scraperEngine } from "@/lib/scrapers/engine/scraper-engine";
import { ScraperFactory } from "@/lib/scrapers/scraper-factory";
import { isVentureBackedSource } from "@/lib/scrapers/source-catalog";
import { isRestrictedSource } from "@/lib/scrapers/source-policy";
import { isYcScraperEnabled } from "@/lib/company-discovery/yc-scraper-config";
import {
  buildDirectoryProfile,
  toDiscoveredCompany,
} from "@/lib/scrapers/utils/to-discovered-company";
import type { ScraperSourceId } from "@/lib/scrapers/types";
import { mapParamsToScraperFilters } from "@/lib/company-discovery/map-scraper-filters";
import { createLogger } from "@/lib/logger";
import type { ProgressReporter } from "@/lib/sse/stream";
import type { CompanyDiscoveryParams, DiscoveredCompany } from "@/types/company";

const log = createLogger("company-discovery.directory-scraper");

/**
 * Discovery targets ONLY funded, venture-backed startups — never general
 * directories. The inline default is the venture-backed sources that aren't
 * gated by source-policy (i.e. verified + fast). In practice that is YC's public
 * API. The heavier VC-portfolio / accelerator sources are Playwright-rendered
 * and opt-in (SCRAPER_ENABLE_RESTRICTED); add them explicitly via
 * DIRECTORY_SCRAPER_SOURCES when your environment can render them.
 */
function defaultVentureBackedSources(): ScraperSourceId[] {
  return ScraperFactory.listSources().filter(
    (source) =>
      isVentureBackedSource(source) &&
      !isRestrictedSource(source) &&
      !(isYcScraperEnabled() && source === "ycombinator")
  );
}

const DEFAULT_MAX_COMPANIES = 25;

/** Directory scrapers are on by default; set ENABLE_DIRECTORY_SCRAPERS=false to disable. */
export function areDirectoryScrapersEnabled(): boolean {
  const raw = process.env.ENABLE_DIRECTORY_SCRAPERS?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  return true;
}

/**
 * Resolve the source list from DIRECTORY_SCRAPER_SOURCES (comma list) or the
 * default. General (non-venture-backed) directories are always rejected — this
 * source only ever scrapes funded, venture-backed startups.
 */
export function getDirectoryScraperSources(): ScraperSourceId[] {
  const fallback = defaultVentureBackedSources();
  const raw = process.env.DIRECTORY_SCRAPER_SOURCES?.trim();
  if (!raw) return fallback;

  const requested = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value): value is ScraperSourceId => ScraperFactory.isValidSource(value))
    .filter((source) => {
      if (isYcScraperEnabled() && source === "ycombinator") {
        return false;
      }
      if (!isVentureBackedSource(source)) {
        log.warn("Ignoring non-venture-backed source in DIRECTORY_SCRAPER_SOURCES", {
          source,
        });
        return false;
      }
      return true;
    });
  return requested.length > 0 ? requested : fallback;
}

function maxCompanies(): number {
  const raw = Number(process.env.DIRECTORY_SCRAPER_MAX);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_COMPANIES;
}

/**
 * Run the directory scraper engine as one discovery source and return fully-formed
 * companies, each carrying its founders + directory profile. Never throws — a
 * scraper failure returns [] so it can't break the primary web/directory search.
 */
export async function runDirectoryScraperDiscovery(
  params: CompanyDiscoveryParams,
  options: {
    knownDedupKeys?: ReadonlySet<string>;
    signal?: AbortSignal;
    onProgress?: ProgressReporter;
    userId?: string;
    searchId?: string | null;
  } = {}
): Promise<DiscoveredCompany[]> {
  if (!areDirectoryScrapersEnabled()) return [];

  const sources = getDirectoryScraperSources();
  if (sources.length === 0) return [];

  const filters = mapParamsToScraperFilters(params);
  const signal = options.signal ?? new AbortController().signal;
  const runOptions = {
    maxCompanies: maxCompanies(),
    maxPages: 1,
    enrichFromWebsite: true, // required to extract founders + contact/careers pages
    concurrency: 3,
    respectRobots: true,
    minIntervalMs: 1_000,
  };

  try {
    options.onProgress?.({ phase: "Scanning startup directories…" });

    const result = await scraperEngine.run({
      ctx: {
        userId: options.userId ?? "discovery",
        searchId: options.searchId ?? null,
        jobId: `inline-${Date.now()}`,
        options: runOptions,
        filters,
        signal,
        onProgress: (event) =>
          options.onProgress?.({
            phase: event.phase,
            current: event.current,
            total: event.total,
            label: event.label,
          }),
      },
      sources,
      options: runOptions,
      knownDedupKeys: options.knownDedupKeys,
    });

    // Attach founders + directory profile onto the mapped company objects.
    const companies = result.profiles.map((profile) => {
      const company = toDiscoveredCompany(profile);
      return {
        ...company,
        founders: profile.founders,
        directoryProfile: buildDirectoryProfile(profile),
      } satisfies DiscoveredCompany;
    });

    if (companies.length > 0) {
      log.info("Directory scrapers contributed companies", {
        sources,
        companies: companies.length,
        withFounders: companies.filter((c) => (c.founders?.length ?? 0) > 0).length,
      });
    }

    return companies;
  } catch (error) {
    log.warn("Directory scraper source failed — continuing without it", {
      error: String(error),
    });
    return [];
  }
}
