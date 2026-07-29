import { BaseScraper } from "@/lib/scrapers/base-scraper";
import type {
  ScraperListingSeed,
  ScraperRunContext,
  ScraperRunOptions,
  ScraperSourceId,
  ScrapedCompanyProfile,
} from "@/lib/scrapers/types";

/**
 * Placeholder scraper for sources not yet implemented.
 * Returns empty results without failing the multi-source run.
 */
export class StubDirectoryScraper extends BaseScraper {
  readonly sourceId: ScraperSourceId;
  readonly displayName: string;
  readonly baseUrl: string;

  constructor(sourceId: ScraperSourceId, displayName: string, baseUrl: string) {
    super();
    this.sourceId = sourceId;
    this.displayName = displayName;
    this.baseUrl = baseUrl;
  }

  async collectListingSeeds(
    _ctx: ScraperRunContext,
    _options: Required<ScraperRunOptions>
  ): Promise<ScraperListingSeed[]> {
    this.logWarn("Directory scraper not implemented yet — skipping source");
    return [];
  }

  async scrapeCompanyProfile(
    _seed: ScraperListingSeed,
    _ctx: ScraperRunContext,
    _options: Required<ScraperRunOptions>
  ): Promise<ScrapedCompanyProfile | null> {
    return null;
  }
}
