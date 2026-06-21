import type { EnrichedLead, LeadEnrichmentInput } from "@/types/lead";

export interface LeadEnrichmentProvider {
  readonly name: string;
  enrich(inputs: LeadEnrichmentInput[]): Promise<EnrichedLead[]>;
}
