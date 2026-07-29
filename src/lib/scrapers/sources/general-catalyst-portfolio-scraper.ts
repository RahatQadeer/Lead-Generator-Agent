import { VcPortfolioScraper } from "@/lib/scrapers/sources/vc-portfolio-scraper";

/**
 * General Catalyst portfolio (https://www.generalcatalyst.com/companies).
 * JS-rendered grid (Playwright). Backer stamped as "General Catalyst".
 * Public listing only.
 */
export class GeneralCatalystPortfolioScraper extends VcPortfolioScraper {
  constructor() {
    super({
      sourceId: "general-catalyst-portfolio",
      displayName: "General Catalyst Portfolio",
      baseUrl: "https://www.generalcatalyst.com",
      firm: "General Catalyst",
      portfolioPaths: ["/companies", "/portfolio"],
      category: "Venture-backed startup",
      renderListing: true,
    });
  }
}
