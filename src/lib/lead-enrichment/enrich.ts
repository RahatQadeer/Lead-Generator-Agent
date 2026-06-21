import { createLeadEnrichmentProvider } from "@/lib/lead-enrichment/factory";
import { isLeadEnrichmentError } from "@/lib/lead-enrichment/errors";
import type { EnrichedLead, LeadEnrichmentInput, LeadEnrichmentResult } from "@/types/lead";

export async function enrichLeadProfiles(
  inputs: LeadEnrichmentInput[],
  searchId: string
): Promise<LeadEnrichmentResult> {
  if (inputs.length === 0) {
    return {
      leads: [],
      provider: "none",
      enrichedCount: 0,
      skippedCount: 0,
    };
  }

  const provider = createLeadEnrichmentProvider();
  const enriched = await provider.enrich(inputs);

  const leads = enriched.map((lead) => ({ ...lead, searchId }));

  return {
    leads,
    provider: provider.name,
    enrichedCount: leads.length,
    skippedCount: 0,
  };
}

export function toLeadEnrichmentErrorResponse(error: unknown) {
  if (isLeadEnrichmentError(error)) {
    return {
      success: false as const,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    };
  }

  return {
    success: false as const,
    error: {
      code: "PROVIDER_ERROR" as const,
      message: "An unexpected error occurred during lead enrichment.",
      retryable: false,
    },
  };
}
