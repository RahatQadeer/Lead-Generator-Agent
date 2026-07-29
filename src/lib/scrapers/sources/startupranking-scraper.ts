import { GenericDirectoryScraper } from "@/lib/scrapers/sources/generic-directory-scraper";

/**
 * Startup Ranking (https://www.startupranking.com) — ranks startups worldwide.
 *
 * ⚠️ Restricted / off by default (see source-policy): the site is behind a
 * Cloudflare managed challenge that blocks datacenter IPs, so this scraper only
 * yields results when routed through residential proxies or a challenge-solving
 * fetch service. Could not be live-verified from a datacenter environment.
 */
export class StartupRankingScraper extends GenericDirectoryScraper {
  constructor() {
    super({
      sourceId: "startupranking",
      displayName: "Startup Ranking",
      baseUrl: "https://www.startupranking.com",
      listingPaths: ["/top", "/countries"],
      // Single-segment startup pages (e.g. /openai), excluding known nav paths.
      profileLinkPattern: /^\/(?!top$|countries$|about$|login$|register$|blog$)[a-z0-9][a-z0-9-]{2,}$/i,
      category: "Startup",
      renderListing: true,
      renderProfile: true,
    });
  }
}
