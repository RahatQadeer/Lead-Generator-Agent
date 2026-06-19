import { ApolloCompanyDiscoveryProvider } from "@/lib/company-discovery/apollo-provider";
import { ApifyCompanyDiscoveryProvider } from "@/lib/company-discovery/apify-provider";
import { CompaniesHouseDiscoveryProvider } from "@/lib/company-discovery/companies-house-provider";
import { CompanyDiscoveryError } from "@/lib/company-discovery/errors";
import { MockCompanyDiscoveryProvider } from "@/lib/company-discovery/mock-provider";
import { ScrapingCompanyDiscoveryProvider } from "@/lib/company-discovery/scraping-provider";
import type { CompanyDiscoveryProvider } from "@/lib/company-discovery/types";
import { isApifyEnabled } from "@/lib/apify/config";
import { isPaidApisDisabled } from "@/lib/providers/free-stack";

export type ProviderName =
  | "mock"
  | "scraping"
  | "companies-house"
  | "apollo"
  | "apify";

export function getConfiguredProviderName(): ProviderName {
  const provider = process.env.COMPANY_DATA_PROVIDER?.toLowerCase();

  if (provider === "apify" && isApifyEnabled()) {
    return "apify";
  }

  if (
    provider === "apollo" &&
    process.env.APOLLO_API_KEY &&
    !isPaidApisDisabled()
  ) {
    return "apollo";
  }

  if (
    (provider === "companies-house" || provider === "companies_house") &&
    process.env.COMPANIES_HOUSE_API_KEY
  ) {
    return "companies-house";
  }

  if (provider === "scraping" || provider === "web") {
    return "scraping";
  }

  if (provider === "mock") {
    return "mock";
  }

  return "scraping";
}

export function createCompanyDiscoveryProvider(): CompanyDiscoveryProvider {
  const providerName = getConfiguredProviderName();

  if (providerName === "apify") {
    return new ApifyCompanyDiscoveryProvider();
  }

  if (providerName === "apollo") {
    if (isPaidApisDisabled()) {
      return new ScrapingCompanyDiscoveryProvider();
    }
    const apiKey = process.env.APOLLO_API_KEY;
    if (!apiKey) {
      throw new CompanyDiscoveryError(
        "PROVIDER_NOT_CONFIGURED",
        "Company search isn't set up on this account. Ask your administrator for help.",
        { statusCode: 500, retryable: false }
      );
    }
    return new ApolloCompanyDiscoveryProvider(apiKey);
  }

  if (providerName === "companies-house") {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    if (!apiKey) {
      throw new CompanyDiscoveryError(
        "PROVIDER_NOT_CONFIGURED",
        "Company search isn't set up on this account. Ask your administrator for help.",
        { statusCode: 500, retryable: false }
      );
    }
    return new CompaniesHouseDiscoveryProvider(apiKey);
  }

  if (providerName === "scraping") {
    return new ScrapingCompanyDiscoveryProvider();
  }

  return new MockCompanyDiscoveryProvider();
}
