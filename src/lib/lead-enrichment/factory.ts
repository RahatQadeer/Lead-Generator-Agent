import { ApolloLeadEnrichmentProvider } from "@/lib/lead-enrichment/apollo-enricher";
import { LeadEnrichmentError } from "@/lib/lead-enrichment/errors";
import { MockLeadEnrichmentProvider } from "@/lib/lead-enrichment/mock-enricher";
import type { LeadEnrichmentProvider } from "@/lib/lead-enrichment/types";

export function createLeadEnrichmentProvider(): LeadEnrichmentProvider {
  const provider = process.env.COMPANY_DATA_PROVIDER?.toLowerCase();

  if (provider === "apollo" && process.env.APOLLO_API_KEY) {
    return new ApolloLeadEnrichmentProvider(process.env.APOLLO_API_KEY);
  }

  if (provider === "apollo") {
    throw new LeadEnrichmentError(
      "PROVIDER_NOT_CONFIGURED",
      "Apollo API key is not configured. Set APOLLO_API_KEY in your environment.",
      { statusCode: 500, retryable: false }
    );
  }

  return new MockLeadEnrichmentProvider();
}
