import { ApolloContactDiscoveryProvider } from "@/lib/contact-discovery/apollo-provider";
import { ContactDiscoveryError } from "@/lib/contact-discovery/errors";
import { MockContactDiscoveryProvider } from "@/lib/contact-discovery/mock-provider";
import type { ContactDiscoveryProvider } from "@/lib/contact-discovery/types";

export type ContactProviderName = "mock" | "apollo";

export function getConfiguredContactProviderName(): ContactProviderName {
  const provider = process.env.COMPANY_DATA_PROVIDER?.toLowerCase();

  if (provider === "apollo" && process.env.APOLLO_API_KEY) {
    return "apollo";
  }

  return "mock";
}

export function createContactDiscoveryProvider(): ContactDiscoveryProvider {
  const providerName = getConfiguredContactProviderName();

  if (providerName === "apollo") {
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

  return new MockContactDiscoveryProvider();
}
