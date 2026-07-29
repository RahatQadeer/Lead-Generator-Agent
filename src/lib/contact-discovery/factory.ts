import { ApolloContactDiscoveryProvider } from "@/lib/contact-discovery/apollo-provider";
import { ApifyContactDiscoveryProvider } from "@/lib/contact-discovery/apify-provider";
import { ContactDiscoveryError } from "@/lib/contact-discovery/errors";
import { MockContactDiscoveryProvider } from "@/lib/contact-discovery/mock-provider";
import { ScrapingContactDiscoveryProvider } from "@/lib/contact-discovery/scraping-provider";
import type { ContactDiscoveryProvider } from "@/lib/contact-discovery/types";
import { isPaidApisDisabled } from "@/lib/providers/free-stack";

export type ContactProviderName =
  | "mock"
  | "scraping"
  | "companies-house"
  | "apollo"
  | "apify";

export function getConfiguredContactProviderName(): ContactProviderName {
  const explicit = process.env.CONTACT_DISCOVERY_PROVIDER?.toLowerCase();

  // People/contact discovery defaults to the SCRAPER — founders and leadership
  // are scraped from the company's own site and the directory listing (YC etc.),
  // never a paid people-data API. The remaining paid providers (Apollo / Apify)
  // require an explicit CONTACT_DISCOVERY_PROVIDER opt-in and are ignored when
  // paid APIs are disabled.
  if (!explicit || explicit === "scraping" || explicit === "web") {
    return "scraping";
  }

  if (explicit === "mock") {
    return "mock";
  }

  if (isPaidApisDisabled()) {
    return "scraping";
  }

  if (explicit === "apollo") return "apollo";
  if (explicit === "apify") return "apify";

  // Any other value falls back to the scraper rather than a paid API.
  return "scraping";
}

export function createContactDiscoveryProvider(): ContactDiscoveryProvider {
  const providerName = getConfiguredContactProviderName();

  if (providerName === "apollo") {
    if (isPaidApisDisabled()) {
      return new ScrapingContactDiscoveryProvider();
    }
    const apiKey = process.env.APOLLO_API_KEY;
    if (!apiKey) {
      throw new ContactDiscoveryError(
        "PROVIDER_NOT_CONFIGURED",
        "Apollo API key is not configured. Set APOLLO_API_KEY in your environment.",
        { statusCode: 500, retryable: false }
      );
    }
    return new ApolloContactDiscoveryProvider(apiKey);
  }

  if (providerName === "apify") {
    return new ApifyContactDiscoveryProvider();
  }

  if (providerName === "scraping" || providerName === "companies-house") {
    return new ScrapingContactDiscoveryProvider();
  }

  return new MockContactDiscoveryProvider();
}
