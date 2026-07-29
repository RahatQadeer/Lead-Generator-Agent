import { VcPortfolioScraper } from "@/lib/scrapers/sources/vc-portfolio-scraper";

/**
 * Sequoia Capital portfolio (https://www.sequoiacap.com/companies). JS-rendered
 * grid (Playwright). Backer stamped as "Sequoia Capital". Public listing only.
 */
export class SequoiaPortfolioScraper extends VcPortfolioScraper {
  constructor() {
    super({
      sourceId: "sequoia-portfolio",
      displayName: "Sequoia Capital Portfolio",
      baseUrl: "https://www.sequoiacap.com",
      firm: "Sequoia Capital",
      portfolioPaths: ["/companies/"],
      category: "Venture-backed startup",
      renderListing: true,
    });
  }
}
