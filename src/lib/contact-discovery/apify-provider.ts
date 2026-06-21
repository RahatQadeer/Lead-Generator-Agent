import { ScrapingContactDiscoveryProvider } from "@/lib/contact-discovery/scraping-provider";
import type {
  ContactDiscoveryProvider,
  ProviderContactSearchResult,
} from "@/lib/contact-discovery/types";
import type { ContactDiscoveryParams } from "@/types/contact";

/**
 * Apify contact discovery — website team-page scraping via Apify actors,
 * with the same title filtering and fallbacks as the free scraping provider.
 */
export class ApifyContactDiscoveryProvider implements ContactDiscoveryProvider {
  readonly name = "apify";
  private readonly scraping = new ScrapingContactDiscoveryProvider();

  async search(params: ContactDiscoveryParams): Promise<ProviderContactSearchResult> {
    return this.scraping.search(params);
  }
}
