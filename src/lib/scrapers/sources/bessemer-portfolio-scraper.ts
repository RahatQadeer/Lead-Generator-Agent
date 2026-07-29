import { VcPortfolioScraper } from "@/lib/scrapers/sources/vc-portfolio-scraper";

/**
 * Bessemer Venture Partners portfolio (https://www.bvp.com/portfolio).
 * JS-rendered grid (Playwright). Backer stamped as "Bessemer Venture
 * Partners". Public listing only.
 */
export class BessemerPortfolioScraper extends VcPortfolioScraper {
  constructor() {
    super({
      sourceId: "bessemer-portfolio",
      displayName: "Bessemer Venture Partners Portfolio",
      baseUrl: "https://www.bvp.com",
      firm: "Bessemer Venture Partners",
      portfolioPaths: ["/portfolio"],
      category: "Venture-backed startup",
      renderListing: true,
    });
  }
}
