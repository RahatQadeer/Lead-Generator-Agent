/**
 * Provider layer bootstrap.
 *
 * The one place providers are registered. Import this before touching the
 * registry; it is idempotent, so route handlers and workers can each call it.
 *
 * Registration order does not matter — `priority` on each entry decides run
 * order. Lower runs first:
 *
 *    10  directory scrapers   free, precise provenance (batch, investors)
 *    50  self-hosted search   free, broad recall, lower precision
 *   100  default
 *   200  paid APIs            billed per call, so they fill gaps rather than lead
 */
import { registerScraperCompanyProviders } from "@/lib/providers/company/from-scraper";
import { createGooglePlacesCompanyProvider } from "@/lib/providers/company/google-places";
import { createPeopleDataLabsProvider } from "@/lib/providers/people/people-data-labs";
import { createGoogleSearchContactProvider } from "@/lib/providers/contact/google-search";
import { registerProvider } from "@/lib/providers/registry";

let bootstrapped = false;

export function bootstrapProviders(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  // --- company ---
  // Every directory source (YC, Techstars, Antler, 500 Global, VC portfolios…)
  // registers itself as an individual company provider.
  registerScraperCompanyProviders();
  registerProvider("google-places", "company", createGooglePlacesCompanyProvider, {
    priority: 200,
  });

  // --- people ---
  registerProvider("people-data-labs", "people", createPeopleDataLabsProvider, {
    priority: 200,
  });

  // --- contact ---
  registerProvider("google-search", "contact", createGoogleSearchContactProvider, {
    priority: 50,
  });

  // --- funding ---
  // No funding provider yet. The kind exists so the pipeline stage and the
  // `funding_events` table can be built against a stable contract.
}

/** Test helper — allows re-running bootstrap after a registry reset. */
export function resetProviderBootstrap(): void {
  bootstrapped = false;
}

export * from "@/lib/providers/types";
export {
  getCompanyProviders,
  getContactProviders,
  getFundingProviders,
  getPeopleProviders,
  describeProviders,
  registerProvider,
} from "@/lib/providers/registry";
export { callProvider, tryProvider } from "@/lib/providers/execute";
export { ProviderError } from "@/lib/providers/errors";
