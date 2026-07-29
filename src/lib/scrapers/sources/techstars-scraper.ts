import { VcPortfolioScraper } from "@/lib/scrapers/sources/vc-portfolio-scraper";

/**
 * Techstars (https://www.techstars.com) — accelerator portfolio of funded
 * startups. The portfolio grid is JS-rendered (Playwright). Every company is
 * stamped with "Techstars" as its backer. Public listing data only.
 */
export class TechstarsScraper extends VcPortfolioScraper {
  constructor() {
    super({
      sourceId: "techstars",
      displayName: "Techstars",
      baseUrl: "https://www.techstars.com",
      firm: "Techstars",
      portfolioPaths: ["/portfolio"],
      category: "Accelerator-backed startup",
      renderListing: true,
    });
  }
}
