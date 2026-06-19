import { ApolloLeadEnrichmentProvider } from "@/lib/lead-enrichment/apollo-enricher";
import { LeadEnrichmentError } from "@/lib/lead-enrichment/errors";
import { MockLeadEnrichmentProvider } from "@/lib/lead-enrichment/mock-enricher";
import { WebsiteLeadEnrichmentProvider } from "@/lib/lead-enrichment/website-enricher";
import type { LeadEnrichmentProvider } from "@/lib/lead-enrichment/types";
import { getConfiguredProviderName } from "@/lib/company-discovery/factory";
import { isPaidApisDisabled } from "@/lib/providers/free-stack";

export function createLeadEnrichmentProvider(): LeadEnrichmentProvider {
  const provider = getConfiguredProviderName();

  if (provider === "apollo") {
    if (isPaidApisDisabled()) {
      return new WebsiteLeadEnrichmentProvider();
    }
    if (!process.env.APOLLO_API_KEY) {
      throw new LeadEnrichmentError(
        "PROVIDER_NOT_CONFIGURED",
        "Apollo API key is not configured. Set APOLLO_API_KEY in your environment.",
        { statusCode: 500, retryable: false }
      );
    }
    return new ApolloLeadEnrichmentProvider(process.env.APOLLO_API_KEY);
  }

  if (provider === "scraping" || provider === "companies-house") {
    return new WebsiteLeadEnrichmentProvider();
  }

  return new MockLeadEnrichmentProvider();
}
