import { afterEach, describe, expect, it } from "vitest";
import { getConfiguredContactProviderName } from "@/lib/contact-discovery/factory";
import { shouldUsePdlEnrichment } from "@/lib/lead-enrichment/enrich-contact-details";

const ENV_KEYS = [
  "CONTACT_DISCOVERY_PROVIDER",
  "PEOPLE_DATA_LABS_API_KEY",
  "DISABLE_PAID_APIS",
] as const;

function resetEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

afterEach(resetEnv);

describe("people/contact discovery defaults to the scraper (not PDL)", () => {
  it("uses the scraper by default even when a PDL key is configured", () => {
    process.env.PEOPLE_DATA_LABS_API_KEY = "pdl-key";
    expect(getConfiguredContactProviderName()).toBe("scraping");
    expect(shouldUsePdlEnrichment()).toBe(false);
  });

  it("uses PDL only when explicitly opted in AND paid APIs are enabled", () => {
    // Free-stack mode is the default (paid APIs off), so opting into PDL also
    // requires DISABLE_PAID_APIS=false.
    process.env.PEOPLE_DATA_LABS_API_KEY = "pdl-key";
    process.env.CONTACT_DISCOVERY_PROVIDER = "pdl";
    process.env.DISABLE_PAID_APIS = "false";
    expect(getConfiguredContactProviderName()).toBe("pdl");
    expect(shouldUsePdlEnrichment()).toBe(true);
  });

  it("keeps PDL off in the default free-stack mode even if opted in", () => {
    // No DISABLE_PAID_APIS override → free stack → scraping.
    process.env.PEOPLE_DATA_LABS_API_KEY = "pdl-key";
    process.env.CONTACT_DISCOVERY_PROVIDER = "pdl";
    expect(getConfiguredContactProviderName()).toBe("scraping");
    expect(shouldUsePdlEnrichment()).toBe(false);
  });

  it("ignores a PDL opt-in when paid APIs are disabled", () => {
    process.env.PEOPLE_DATA_LABS_API_KEY = "pdl-key";
    process.env.CONTACT_DISCOVERY_PROVIDER = "pdl";
    process.env.DISABLE_PAID_APIS = "true";
    expect(getConfiguredContactProviderName()).toBe("scraping");
    expect(shouldUsePdlEnrichment()).toBe(false);
  });

  it("treats an unknown provider value as the scraper", () => {
    process.env.CONTACT_DISCOVERY_PROVIDER = "something-else";
    expect(getConfiguredContactProviderName()).toBe("scraping");
  });
});
