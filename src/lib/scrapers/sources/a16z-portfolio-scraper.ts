import { VcPortfolioScraper } from "@/lib/scrapers/sources/vc-portfolio-scraper";

/**
 * Andreessen Horowitz (a16z) portfolio (https://a16z.com/portfolio). JS-rendered
 * grid (Playwright). Backer stamped as "Andreessen Horowitz". Public listing only.
 */
export class A16zPortfolioScraper extends VcPortfolioScraper {
  constructor() {
    super({
      sourceId: "a16z-portfolio",
      displayName: "Andreessen Horowitz Portfolio",
      baseUrl: "https://a16z.com",
      firm: "Andreessen Horowitz",
      portfolioPaths: ["/portfolio/"],
      category: "Venture-backed startup",
      renderListing: true,
    });
  }
}
