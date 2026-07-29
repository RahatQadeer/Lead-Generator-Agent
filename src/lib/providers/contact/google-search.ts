/**
 * Google Search — contact provider integration point.
 *
 * NOT YET IMPLEMENTED. This is the "search-pattern" layer of contact discovery:
 * given a person and their company, run targeted queries that surface a public
 * profile or a published business address.
 *
 * Implementation notes:
 *   - The existing SearXNG stack (`lib/scraping/searxng-search.ts`) already
 *     performs web search for company discovery and is self-hosted, so it should
 *     back this provider by default. A paid CSE key is the fallback, not the
 *     primary — hence tier "free" when SearXNG is configured.
 *   - Query patterns worth running, in precision order:
 *       "<name>" "<company>" site:linkedin.com/in
 *       "<name>" "<company>" (email OR contact)
 *       site:<domain> "<name>"
 *     Stop at the first that yields a validated hit; running all three per person
 *     triples cost for a small recall gain.
 *   - Anything extracted here is UNVERIFIED. Set `emailIsGuessed` and a
 *     confidence below the website-scrape layer so the merge in the contact stage
 *     prefers an observed address over a searched one.
 *   - Never accept a personal inbox from a search snippet — this codebase only
 *     collects published business contact details.
 */
import { ProviderError } from "@/lib/providers/errors";
import { getSearxngBaseUrl } from "@/lib/scraping/searxng-search";
import type {
  ContactChannels,
  ContactProvider,
  ContactTarget,
  ProviderContext,
} from "@/lib/providers/types";

export function createGoogleSearchContactProvider(): ContactProvider {
  return {
    id: "google-search",
    displayName: "Web search (patterns)",
    kind: "contact",
    // Free while backed by self-hosted SearXNG; flip to "paid" if a metered CSE
    // key becomes the primary backend.
    tier: "free",

    // Search engines rate-limit aggressively and this runs per person, so keep
    // it slow enough that a 200-lead run does not get the instance blocked.
    rateLimit: { requestsPerSecond: 1, burst: 2, maxConcurrent: 2 },

    isConfigured: () => Boolean(getSearxngBaseUrl()),

    findContacts(
      _target: ContactTarget,
      _ctx: ProviderContext
    ): Promise<ContactChannels | null> {
      throw new ProviderError({
        provider: "google-search",
        code: "NOT_CONFIGURED",
        message:
          "Search-pattern contact discovery is an integration point and is not implemented yet.",
      });
    },
  };
}
