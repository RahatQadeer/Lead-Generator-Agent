import { GenericDirectoryScraper } from "@/lib/scrapers/sources/generic-directory-scraper";

/**
 * Indie Hackers (https://www.indiehackers.com) — bootstrapped founder products.
 *
 * ⚠️ Restricted / off by default (see source-policy): Indie Hackers is a
 * client-side React SPA that renders navigation without anchor <href>s and
 * loads its product feed from an internal API, so generic HTML link extraction
 * finds nothing. Productive scraping requires integrating its internal JSON API
 * (or a headless flow that intercepts those XHR calls). ToS also restricts
 * automated access. Could not be live-verified via HTML from this environment.
 */
export class IndieHackersScraper extends GenericDirectoryScraper {
  constructor() {
    super({
      sourceId: "indiehackers",
      displayName: "Indie Hackers",
      baseUrl: "https://www.indiehackers.com",
      listingPaths: ["/products"],
      profileLinkPattern: /\/product\/[a-z0-9][a-z0-9-]+$/i,
      category: "Bootstrapped Startup",
      renderListing: true,
      renderProfile: true,
    });
  }
}
