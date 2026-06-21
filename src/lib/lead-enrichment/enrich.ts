import { createLeadEnrichmentProvider } from "@/lib/lead-enrichment/factory";
import { isLeadEnrichmentError } from "@/lib/lead-enrichment/errors";
import { partitionEnrichedLeads } from "@/lib/lead-enrichment/finalize-lead";
import type { LeadEnrichmentInput, LeadEnrichmentResult } from "@/types/lead";

export async function enrichLeadProfiles(
  inputs: LeadEnrichmentInput[],
  searchId: string
): Promise<LeadEnrichmentResult & { discardedIds: string[] }> {
  if (inputs.length === 0) {
    return {
      leads: [],
      provider: "none",
      enrichedCount: 0,
      skippedCount: 0,
      discardedCount: 0,
      discardedIds: [],
    };
  }

  const provider = createLeadEnrichmentProvider();
  const enriched = await provider.enrich(inputs);

  const withSearch = enriched.map((lead) => ({ ...lead, searchId }));
  const { kept, discardedIds } = partitionEnrichedLeads(withSearch);

  return {
    leads: kept,
    provider: provider.name,
    enrichedCount: kept.length,
    skippedCount: 0,
    discardedCount: discardedIds.length,
    discardedIds,
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
      message: "Something went wrong while enriching profiles. Please try again.",
      retryable: false,
    },
  };
}
