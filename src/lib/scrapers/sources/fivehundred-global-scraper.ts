import { VcPortfolioScraper } from "@/lib/scrapers/sources/vc-portfolio-scraper";

/**
 * 500 Global (https://500.co) — accelerator/VC portfolio of funded startups.
 * JS-rendered grid (Playwright). Backer stamped as "500 Global". Public only.
 */
export class FiveHundredGlobalScraper extends VcPortfolioScraper {
  constructor() {
    super({
      sourceId: "500global",
      displayName: "500 Global",
      baseUrl: "https://500.co",
      firm: "500 Global",
      portfolioPaths: ["/portfolio", "/companies"],
      category: "Accelerator-backed startup",
      renderListing: true,
    });
  }
}
