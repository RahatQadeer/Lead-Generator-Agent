import { ApolloCompanyDiscoveryProvider } from "@/lib/company-discovery/apollo-provider";
import { CompanyDiscoveryError } from "@/lib/company-discovery/errors";
import { MockCompanyDiscoveryProvider } from "@/lib/company-discovery/mock-provider";
import type { CompanyDiscoveryProvider } from "@/lib/company-discovery/types";

export type ProviderName = "mock" | "apollo";

export function getConfiguredProviderName(): ProviderName {
  const provider = process.env.COMPANY_DATA_PROVIDER?.toLowerCase();

  if (provider === "apollo" && process.env.APOLLO_API_KEY) {
    return "apollo";
  }

  return "mock";
}

export function createCompanyDiscoveryProvider(): CompanyDiscoveryProvider {
  const providerName = getConfiguredProviderName();

  if (providerName === "apollo") {
    const apiKey = process.env.APOLLO_API_KEY;
    if (!apiKey) {
      throw new CompanyDiscoveryError(
        "PROVIDER_NOT_CONFIGURED",
        "Apollo API key is not configured. Set APOLLO_API_KEY in your environment.",
        { statusCode: 500, retryable: false }
      );
    }
    return new ApolloCompanyDiscoveryProvider(apiKey);
  }

  return new MockCompanyDiscoveryProvider();
}
