import { scraperEngine } from "@/lib/scrapers/engine/scraper-engine";
import {
  buildDirectoryProfile,
  toDiscoveredCompany,
} from "@/lib/scrapers/utils/to-discovered-company";
import { createLogger } from "@/lib/logger";
import type { ProgressReporter } from "@/lib/sse/stream";
import type { CompanyDiscoveryParams, DiscoveredCompany } from "@/types/company";
import { mapParamsToScraperFilters } from "@/lib/company-discovery/map-scraper-filters";
import {
  isYcScraperEnabled,
  ycScraperMaxCompanies,
  ycScraperMaxPages,
} from "@/lib/company-discovery/yc-scraper-config";

const log = createLogger("company-discovery.yc-scraper");

/**
 * Scrape ycombinator.com for companies matching the search filters and attach
 * founder / CEO contacts from each company's YC profile page.
 */
export async function runYcScraperDiscovery(
  params: CompanyDiscoveryParams,
  options: {
    knownDedupKeys?: ReadonlySet<string>;
    signal?: AbortSignal;
    onProgress?: ProgressReporter;
    userId?: string;
    searchId?: string | null;
  } = {}
): Promise<DiscoveredCompany[]> {
  if (!isYcScraperEnabled()) return [];

  const filters = mapParamsToScraperFilters(params);
  const signal = options.signal ?? new AbortController().signal;
  const runOptions = {
    maxCompanies: ycScraperMaxCompanies(),
    maxPages: ycScraperMaxPages(),
    // Founders come from YC profile pages — skip slow per-company website crawls.
    enrichFromWebsite: false,
    concurrency: 3,
    respectRobots: true,
    minIntervalMs: 1_000,
  };

  try {
    options.onProgress?.({ phase: "Scraping Y Combinator directory…" });

    const result = await scraperEngine.run({
      ctx: {
        userId: options.userId ?? "discovery",
        searchId: options.searchId ?? null,
        jobId: `yc-inline-${Date.now()}`,
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
      sources: ["ycombinator"],
      options: runOptions,
      knownDedupKeys: options.knownDedupKeys,
    });

    const companies = result.profiles.map((profile) => {
      const company = toDiscoveredCompany(profile);
      return {
        ...company,
        founders: profile.founders,
        directoryProfile: buildDirectoryProfile(profile),
      } satisfies DiscoveredCompany;
    });

    if (companies.length > 0) {
      log.info("YC scraper contributed companies", {
        companies: companies.length,
        withFounders: companies.filter((c) => (c.founders?.length ?? 0) > 0).length,
      });
    }

    return companies;
  } catch (error) {
    log.warn("YC scraper failed — continuing without it", { error: String(error) });
    return [];
  }
}
