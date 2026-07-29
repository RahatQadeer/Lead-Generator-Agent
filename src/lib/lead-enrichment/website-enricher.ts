import { formatLocation } from "@/lib/lead-enrichment/format-location";
import { enrichContactDetailsFromWebsite } from "@/lib/lead-enrichment/enrich-contact-details";
import type { LeadEnrichmentProvider } from "@/lib/lead-enrichment/types";
import { createLogger } from "@/lib/logger";
import { upgradePartialPersonName } from "@/lib/scraping/contact-name-match";
import { mapPool } from "@/lib/scraping/parallel-pool";
import type { ProgressReporter } from "@/lib/sse/stream";
import type { EnrichedLead, LeadEnrichmentInput } from "@/types/lead";

const log = createLogger("lead-enrichment.website");

const ENRICH_CONCURRENCY = 5;

export class WebsiteLeadEnrichmentProvider implements LeadEnrichmentProvider {
  readonly name: string;

  constructor() {
    // Contact details are resolved by scraping public web sources only.
    this.name = "scraping";
  }

  async enrich(
    inputs: LeadEnrichmentInput[],
    onProgress?: ProgressReporter
  ): Promise<EnrichedLead[]> {
    const enrichedAt = new Date().toISOString();
    const total = inputs.length;
    let done = 0;
    onProgress?.({ phase: "Finding contact details…", current: 0, total });

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
          phone: null,
          phoneSource: null,
          socialProfiles: null,
          contactDetailType: null,
          contactPageUrl: null,
          confidenceScore: 0,
        };
      }
      const city = input.companyCity;
      const state = input.companyState;
      const country = input.companyCountry;

      const displayName = upgradePartialPersonName(
        input.fullName,
        details.resolvedFullName
      );

      done += 1;
      onProgress?.({
        phase: "Finding contact details…",
        current: done,
        total,
        label: input.fullName,
      });

      return {
        id: input.id,
        name: displayName,
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
        phone: details.phone,
        phoneSource: details.phoneSource,
        socialProfiles: details.socialProfiles,
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
