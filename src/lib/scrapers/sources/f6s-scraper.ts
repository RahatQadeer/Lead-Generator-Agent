import { GenericDirectoryScraper } from "@/lib/scrapers/sources/generic-directory-scraper";

/**
 * F6S (https://www.f6s.com) — startup & accelerator community directory.
 *
 * ⚠️ Restricted / off by default (see source-policy): F6S serves a
 * "Checking your browser" anti-bot interstitial that blocks headless browsers
 * from datacenter IPs, and its ToS restricts automated access. Yields results
 * only via residential proxies or a challenge-solving fetch service. Playwright
 * from a datacenter IP returned no content during verification.
 */
export class F6SScraper extends GenericDirectoryScraper {
  constructor() {
    super({
      sourceId: "f6s",
      displayName: "F6S",
      baseUrl: "https://www.f6s.com",
      listingPaths: ["/companies", "/startups"],
      profileLinkPattern: /^\/(?!companies$|startups$|about$|login$|signup$)[a-z0-9][a-z0-9-]{2,}$/i,
      category: "Startup",
      renderListing: true,
      renderProfile: true,
    });
  }
}
