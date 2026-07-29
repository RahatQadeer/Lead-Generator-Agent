import { BaseScraper } from "@/lib/scrapers/base-scraper";
import { YCombinatorScraper } from "@/lib/scrapers/sources/yc-scraper";
import { GithubOrganizationsScraper } from "@/lib/scrapers/sources/github-organizations-scraper";
import { ProductHuntScraper } from "@/lib/scrapers/sources/producthunt-scraper";
import { BetaListScraper } from "@/lib/scrapers/sources/betalist-scraper";
import { SaaSHubScraper } from "@/lib/scrapers/sources/saashub-scraper";
import { StartupRankingScraper } from "@/lib/scrapers/sources/startupranking-scraper";
import { SeedtableScraper } from "@/lib/scrapers/sources/seedtable-scraper";
import { OpenVCScraper } from "@/lib/scrapers/sources/openvc-scraper";
import { F6SScraper } from "@/lib/scrapers/sources/f6s-scraper";
import { IndieHackersScraper } from "@/lib/scrapers/sources/indiehackers-scraper";
import { TechstarsScraper } from "@/lib/scrapers/sources/techstars-scraper";
import { FiveHundredGlobalScraper } from "@/lib/scrapers/sources/fivehundred-global-scraper";
import { AntlerScraper } from "@/lib/scrapers/sources/antler-scraper";
import { SequoiaPortfolioScraper } from "@/lib/scrapers/sources/sequoia-portfolio-scraper";
import { A16zPortfolioScraper } from "@/lib/scrapers/sources/a16z-portfolio-scraper";
import { AccelPortfolioScraper } from "@/lib/scrapers/sources/accel-portfolio-scraper";
import { LightspeedPortfolioScraper } from "@/lib/scrapers/sources/lightspeed-portfolio-scraper";
import { GeneralCatalystPortfolioScraper } from "@/lib/scrapers/sources/general-catalyst-portfolio-scraper";
import { BessemerPortfolioScraper } from "@/lib/scrapers/sources/bessemer-portfolio-scraper";
import { IndexVenturesPortfolioScraper } from "@/lib/scrapers/sources/index-ventures-portfolio-scraper";
import type { ScraperSourceId } from "@/lib/scrapers/types";

type ScraperConstructor = new () => BaseScraper;

/** Register scrapers here — one file per source, no engine changes required. */
const SCRAPER_REGISTRY: Record<ScraperSourceId, ScraperConstructor> = {
  // Venture-backed: accelerators
  ycombinator: YCombinatorScraper,
  techstars: TechstarsScraper,
  "500global": FiveHundredGlobalScraper,
  antler: AntlerScraper,
  // Venture-backed: startup / investor directories
  f6s: F6SScraper,
  openvc: OpenVCScraper,
  seedtable: SeedtableScraper,
  // Venture-backed: VC firm portfolios
  "sequoia-portfolio": SequoiaPortfolioScraper,
  "a16z-portfolio": A16zPortfolioScraper,
  "accel-portfolio": AccelPortfolioScraper,
  "lightspeed-portfolio": LightspeedPortfolioScraper,
  "general-catalyst-portfolio": GeneralCatalystPortfolioScraper,
  "bessemer-portfolio": BessemerPortfolioScraper,
  "index-ventures-portfolio": IndexVenturesPortfolioScraper,
  // General directories (registered, excluded from venture-backed discovery)
  producthunt: ProductHuntScraper,
  betalist: BetaListScraper,
  indiehackers: IndieHackersScraper,
  startupranking: StartupRankingScraper,
  saashub: SaaSHubScraper,
  "github-organizations": GithubOrganizationsScraper,
};

export function listRegisteredScrapers(): ScraperSourceId[] {
  return Object.keys(SCRAPER_REGISTRY) as ScraperSourceId[];
}

/**
 * The registry as (id, constructor) pairs, for callers that need to wrap every
 * scraper uniformly — the discovery registry adapts each one to the common
 * `CompanyScraper` stream contract. Exported so that mapping is derived from
 * this table rather than duplicating it.
 */
export const SCRAPER_REGISTRY_ENTRIES: ReadonlyArray<
  readonly [ScraperSourceId, ScraperConstructor]
> = Object.entries(SCRAPER_REGISTRY) as Array<
  [ScraperSourceId, ScraperConstructor]
>;

export function isRegisteredScraper(source: string): source is ScraperSourceId {
  return source in SCRAPER_REGISTRY;
}

export function createScraperFromRegistry(source: ScraperSourceId): BaseScraper {
  const ctor = SCRAPER_REGISTRY[source];
  if (!ctor) {
    throw new Error(`No scraper registered for source: ${source}`);
  }
  return new ctor();
}
