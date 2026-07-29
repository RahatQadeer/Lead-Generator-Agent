import { createScraperFromRegistry, isRegisteredScraper } from "@/lib/scrapers/registry";
import type { BaseScraper } from "@/lib/scrapers/base-scraper";
import type { ScraperSourceId } from "@/lib/scrapers/types";
import { SCRAPER_SOURCE_IDS } from "@/lib/scrapers/types";

export class ScraperFactory {
  static listSources(): ScraperSourceId[] {
    return [...SCRAPER_SOURCE_IDS];
  }

  static isValidSource(source: string): source is ScraperSourceId {
    return isRegisteredScraper(source);
  }

  static create(source: ScraperSourceId): BaseScraper {
    return createScraperFromRegistry(source);
  }

  static createMany(sources: ScraperSourceId[]): BaseScraper[] {
    return sources.map((source) => this.create(source));
  }
}
