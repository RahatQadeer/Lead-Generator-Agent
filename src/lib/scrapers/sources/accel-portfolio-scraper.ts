import { VcPortfolioScraper } from "@/lib/scrapers/sources/vc-portfolio-scraper";

/**
 * Accel portfolio (https://www.accel.com/companies). JS-rendered grid
 * (Playwright). Backer stamped as "Accel". Public listing only.
 */
export class AccelPortfolioScraper extends VcPortfolioScraper {
  constructor() {
    super({
      sourceId: "accel-portfolio",
      displayName: "Accel Portfolio",
      baseUrl: "https://www.accel.com",
      firm: "Accel",
      portfolioPaths: ["/companies"],
      category: "Venture-backed startup",
      renderListing: true,
    });
  }
}
