import { GenericDirectoryScraper } from "@/lib/scrapers/sources/generic-directory-scraper";

/**
 * OpenVC (https://www.openvc.app) — public directory of investors/funds.
 *
 * ⚠️ Restricted / off by default (see source-policy): Cloudflare-protected and
 * ToS restricts automated access. Yields results only via residential proxies
 * or a challenge-solving fetch service, and only where you have the right to
 * scrape it. Could not be live-verified here.
 */
export class OpenVCScraper extends GenericDirectoryScraper {
  constructor() {
    super({
      sourceId: "openvc",
      displayName: "OpenVC",
      baseUrl: "https://www.openvc.app",
      listingPaths: ["/investors", "/search"],
      profileLinkPattern: /\/(fund|investor|profile)\/[a-z0-9][a-z0-9-]+$/i,
      category: "Investor / Fund",
      renderListing: true,
      renderProfile: true,
    });
  }
}
