import { GenericDirectoryScraper } from "@/lib/scrapers/sources/generic-directory-scraper";

/**
 * Seedtable (https://www.seedtable.com) — curated European startup lists.
 *
 * ⚠️ Restricted / off by default (see source-policy): Cloudflare-protected;
 * blocks datacenter IPs. Yields results only via residential proxies or a
 * challenge-solving fetch service. Could not be live-verified here.
 */
export class SeedtableScraper extends GenericDirectoryScraper {
  constructor() {
    super({
      sourceId: "seedtable",
      displayName: "Seedtable",
      baseUrl: "https://www.seedtable.com",
      listingPaths: ["/startups", "/best-startups-in-europe"],
      profileLinkPattern: /\/(companies|startups)\/[a-z0-9][a-z0-9-]+$/i,
      category: "Startup",
      renderListing: true,
      renderProfile: true,
    });
  }
}
