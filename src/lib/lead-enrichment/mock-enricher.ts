import { formatLocation } from "@/lib/lead-enrichment/format-location";
import { MOCK_PERSON_PROFILES } from "@/lib/lead-enrichment/mock-profiles";
import type { LeadEnrichmentProvider } from "@/lib/lead-enrichment/types";
import type { EnrichedLead, LeadEnrichmentInput } from "@/types/lead";

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildMockLinkedIn(fullName: string): string {
  return `https://linkedin.com/in/${slugify(fullName)}`;
}

export class MockLeadEnrichmentProvider implements LeadEnrichmentProvider {
  readonly name = "mock";

  async enrich(inputs: LeadEnrichmentInput[]): Promise<EnrichedLead[]> {
    await new Promise((r) => setTimeout(r, 300));

    const enrichedAt = new Date().toISOString();

    return inputs.map((input) => {
      const profile = input.email
        ? MOCK_PERSON_PROFILES[input.email.toLowerCase()]
        : undefined;

      const city = profile?.city ?? input.companyCity;
      const state = profile?.state ?? input.companyState;
      const country = profile?.country ?? input.companyCountry;
      const linkedin =
        input.linkedinUrl ??
        profile?.linkedinUrl ??
        buildMockLinkedIn(input.fullName);

      return {
        id: input.id,
        name: input.fullName,
        role: input.title,
        company: input.companyName,
        linkedin,
        city,
        state,
        country,
        location: formatLocation(city, state, country),
        email: input.email,
        emailSyntaxValid: null,
        emailDomainValid: null,
        emailVerificationStatus: null,
        emailVerifiedAt: null,
        companyId: input.companyId,
        searchId: null,
        enrichedAt,
      };
    });
  }
}
