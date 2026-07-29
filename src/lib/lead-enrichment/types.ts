import type { EnrichedLead, LeadEnrichmentInput } from "@/types/lead";
import type { ProgressReporter } from "@/lib/sse/stream";

export interface LeadEnrichmentProvider {
  readonly name: string;
  enrich(
    inputs: LeadEnrichmentInput[],
    onProgress?: ProgressReporter
  ): Promise<EnrichedLead[]>;
}
