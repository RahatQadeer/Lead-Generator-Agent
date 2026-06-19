import { formatLocation } from "@/lib/lead-enrichment/format-location";
import { enrichContactDetailsFromWebsite } from "@/lib/lead-enrichment/enrich-contact-details";
import type { LeadEnrichmentProvider } from "@/lib/lead-enrichment/types";
import { createLogger } from "@/lib/logger";
import { isPeopleDataLabsConfigured } from "@/lib/people-data-labs/config";
import { mapPool } from "@/lib/scraping/parallel-pool";
import type { EnrichedLead, LeadEnrichmentInput } from "@/types/lead";

const log = createLogger("lead-enrichment.website");

const ENRICH_CONCURRENCY = 3;

export class WebsiteLeadEnrichmentProvider implements LeadEnrichmentProvider {
  readonly name: string;

  constructor() {
    this.name = isPeopleDataLabsConfigured() ? "pdl" : "scraping";
  }

  async enrich(inputs: LeadEnrichmentInput[]): Promise<EnrichedLead[]> {
    const enrichedAt = new Date().toISOString();

    return mapPool(inputs, ENRICH_CONCURRENCY, async (input) => {
      let details;
      try {
        details = await enrichContactDetailsFromWebsite(input);
      } catch (error) {
        log.warn("Contact enrichment failed — using empty details", {
          name: input.fullName,
          company: input.companyName,
          error: String(error),
        });
        details = {
          email: null,
          linkedinUrl: null,
          emailSource: null,
          linkedInSource: null,
          contactDetailType: null,
          contactPageUrl: null,
          confidenceScore: 0,
        };
      }
      const city = input.companyCity;
      const state = input.companyState;
      const country = input.companyCountry;

      return {
        id: input.id,
        name: input.fullName,
        role: input.title,
        company: input.companyName,
        linkedin: details.linkedinUrl,
        city,
        state,
        country,
        location: formatLocation(city, state, country),
        email: details.email,
        emailIsGuessed: details.emailIsGuessed ?? false,
        emailSource: details.emailSource,
        linkedInSource: details.linkedInSource,
        contactDetailType: details.contactDetailType,
        contactPageUrl: details.contactPageUrl,
        confidenceScore: details.confidenceScore,
        outreachChannel: null,
        emailSyntaxValid: null,
        emailDomainValid: null,
        emailVerificationStatus: null,
        emailVerifiedAt: null,
        leadScore: null,
        leadScoreFactors: null,
        leadScoredAt: null,
        intentScore: null,
        intentSignals: null,
        companyId: input.companyId,
        searchId: null,
        enrichedAt,
        followUpsPaused: false,
        followUpsPausedReason: null,
      };
    });
  }
}
