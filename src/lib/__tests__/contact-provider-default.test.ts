import { afterEach, describe, expect, it } from "vitest";
import { getConfiguredContactProviderName } from "@/lib/contact-discovery/factory";

const ENV_KEYS = ["CONTACT_DISCOVERY_PROVIDER", "DISABLE_PAID_APIS"] as const;

function resetEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

afterEach(resetEnv);

describe("people/contact discovery defaults to the scraper", () => {
  it("uses the scraper when nothing is configured", () => {
    expect(getConfiguredContactProviderName()).toBe("scraping");
  });

  it("uses the scraper when explicitly asked for scraping", () => {
    process.env.CONTACT_DISCOVERY_PROVIDER = "scraping";
    expect(getConfiguredContactProviderName()).toBe("scraping");
  });

  it("falls back to the scraper when paid APIs are disabled", () => {
    process.env.CONTACT_DISCOVERY_PROVIDER = "apollo";
    process.env.DISABLE_PAID_APIS = "true";
    expect(getConfiguredContactProviderName()).toBe("scraping");
  });

  it("honours an explicit paid opt-in only when paid APIs are enabled", () => {
    process.env.CONTACT_DISCOVERY_PROVIDER = "apollo";
    process.env.DISABLE_PAID_APIS = "false";
    expect(getConfiguredContactProviderName()).toBe("apollo");
  });

  it("treats an unknown provider value as the scraper", () => {
    process.env.CONTACT_DISCOVERY_PROVIDER = "something-else";
    expect(getConfiguredContactProviderName()).toBe("scraping");
  });
});
