import { VcPortfolioScraper } from "@/lib/scrapers/sources/vc-portfolio-scraper";

/**
 * Lightspeed Venture Partners portfolio (https://lsvp.com/portfolio).
 * JS-rendered grid (Playwright). Backer stamped as "Lightspeed Venture
 * Partners". Public listing only.
 */
export class LightspeedPortfolioScraper extends VcPortfolioScraper {
  constructor() {
    super({
      sourceId: "lightspeed-portfolio",
      displayName: "Lightspeed Portfolio",
      baseUrl: "https://lsvp.com",
      firm: "Lightspeed Venture Partners",
      portfolioPaths: ["/portfolio/"],
      category: "Venture-backed startup",
      renderListing: true,
    });
  }
}
