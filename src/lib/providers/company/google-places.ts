/**
 * Google Places — company provider integration point.
 *
 * NOT YET IMPLEMENTED. The shape, credentials, rate limit and cost tier are
 * defined so the pipeline can already route to it; `isConfigured()` returns
 * false without an API key, so the registry skips it and no run is affected.
 *
 * Wiring it up means filling in `discover()` only — nothing else in the layer or
 * the pipeline changes.
 *
 * Implementation notes for whoever picks this up:
 *   - Text Search (`places:searchText`) is the right endpoint: it takes a
 *     free-text query plus an optional region, which maps onto industry +
 *     country. Nearby Search needs coordinates we do not have.
 *   - Places returns local businesses, so it is strong for regional B2B and weak
 *     for venture-backed startups, which often have no storefront listing. Treat
 *     it as a complement to the directory scrapers, not a replacement.
 *   - `websiteUri` is the field worth having; a Places result without one cannot
 *     be deduped against scraped companies and should be dropped.
 *   - Billing is per request AND per requested field. Always send a
 *     `X-Goog-FieldMask` header; omitting it bills the most expensive SKU.
 */
import type { ScrapedCompanyProfile } from "@/lib/scrapers/types";
import { ProviderError } from "@/lib/providers/errors";
import type {
  CompanyCriteria,
  CompanyProvider,
  ProviderContext,
} from "@/lib/providers/types";

export function googlePlacesApiKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || null;
}

export function createGooglePlacesCompanyProvider(): CompanyProvider {
  return {
    id: "google-places",
    displayName: "Google Places",
    kind: "company",
    tier: "paid",

    // Places allows far more, but company discovery is not latency-critical and
    // this keeps a runaway loop from becoming a large bill.
    rateLimit: { requestsPerSecond: 10, burst: 20, maxConcurrent: 5 },

    isConfigured: () => Boolean(googlePlacesApiKey()),

    // eslint-disable-next-line require-yield
    async *discover(
      _criteria: CompanyCriteria,
      _ctx: ProviderContext
    ): AsyncIterable<ScrapedCompanyProfile> {
      throw new ProviderError({
        provider: "google-places",
        code: "NOT_CONFIGURED",
        message:
          "Google Places company discovery is an integration point and is not implemented yet.",
      });
    },
  };
}
