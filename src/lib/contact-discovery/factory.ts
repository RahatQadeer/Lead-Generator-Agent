import { ApolloContactDiscoveryProvider } from "@/lib/contact-discovery/apollo-provider";
import { ApifyContactDiscoveryProvider } from "@/lib/contact-discovery/apify-provider";
import { ContactDiscoveryError } from "@/lib/contact-discovery/errors";
import { MockContactDiscoveryProvider } from "@/lib/contact-discovery/mock-provider";
import { HybridContactDiscoveryProvider } from "@/lib/contact-discovery/hybrid-contact-provider";
import { ScrapingContactDiscoveryProvider } from "@/lib/contact-discovery/scraping-provider";
import type { ContactDiscoveryProvider } from "@/lib/contact-discovery/types";
import { getConfiguredProviderName } from "@/lib/company-discovery/factory";
import { isPeopleDataLabsConfigured } from "@/lib/people-data-labs/config";
import { isPaidApisDisabled } from "@/lib/providers/free-stack";

export type ContactProviderName =
  | "mock"
  | "scraping"
  | "companies-house"
  | "apollo"
  | "apify"
  | "pdl";

export function getConfiguredContactProviderName(): ContactProviderName {
  const explicit = process.env.CONTACT_DISCOVERY_PROVIDER?.toLowerCase();

  if (
    (explicit === "pdl" || explicit === "people-data-labs" || explicit === "peopledatalabs") &&
    isPeopleDataLabsConfigured()
  ) {
    return "pdl";
  }

  if (!explicit && isPeopleDataLabsConfigured()) {
    return "pdl";
  }

  if (explicit === "scraping" || explicit === "web") {
    return "scraping";
  }

  if (explicit === "mock") {
    return "mock";
  }

  return getConfiguredProviderName() as ContactProviderName;
}

export function createContactDiscoveryProvider(): ContactDiscoveryProvider {
  const providerName = getConfiguredContactProviderName();

  if (providerName === "pdl") {
    if (!isPeopleDataLabsConfigured()) {
      throw new ContactDiscoveryError(
        "PROVIDER_NOT_CONFIGURED",
        "People Data Labs API key is not configured. Set PEOPLE_DATA_LABS_API_KEY in your environment.",
        { statusCode: 500, retryable: false }
      );
    }
    return new HybridContactDiscoveryProvider();
  }

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
