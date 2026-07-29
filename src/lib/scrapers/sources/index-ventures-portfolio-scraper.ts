import { VcPortfolioScraper } from "@/lib/scrapers/sources/vc-portfolio-scraper";

/**
 * Index Ventures portfolio (https://www.indexventures.com/companies).
 * JS-rendered grid (Playwright). Backer stamped as "Index Ventures".
 * Public listing only.
 */
export class IndexVenturesPortfolioScraper extends VcPortfolioScraper {
  constructor() {
    super({
      sourceId: "index-ventures-portfolio",
      displayName: "Index Ventures Portfolio",
      baseUrl: "https://www.indexventures.com",
      firm: "Index Ventures",
      portfolioPaths: ["/companies/", "/companies"],
      category: "Venture-backed startup",
      renderListing: true,
    });
  }
}
