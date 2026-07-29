import { VcPortfolioScraper } from "@/lib/scrapers/sources/vc-portfolio-scraper";

/**
 * Antler (https://www.antler.co) — early-stage VC/incubator portfolio of funded
 * startups. JS-rendered grid (Playwright). Backer stamped as "Antler". Public only.
 */
export class AntlerScraper extends VcPortfolioScraper {
  constructor() {
    super({
      sourceId: "antler",
      displayName: "Antler",
      baseUrl: "https://www.antler.co",
      firm: "Antler",
      portfolioPaths: ["/portfolio"],
      category: "Venture-backed startup",
      renderListing: true,
    });
  }
}
