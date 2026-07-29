/**
 * Website contact provider — the default, free way to resolve contact channels.
 *
 * Wraps `enrichContactDetailsFromWebsite`, which already runs the layered
 * strategy: company site, contact/team pages, email-pattern inference, LinkedIn
 * profile resolution and DNS/SMTP-shaped verification. None of that is
 * reimplemented; this adapts it to the provider contract.
 *
 * This provider is the PRIMARY contact layer, so it runs at a low priority
 * number. Search patterns and paid enrichment fill gaps it leaves — never the
 * other way round, because an address observed on the company's own site beats
 * anything inferred elsewhere.
 */
import { enrichContactDetailsFromWebsite } from "@/lib/lead-enrichment/enrich-contact-details";
import { createLogger } from "@/lib/logger";
import type {
  ContactChannels,
  ContactProvider,
  ContactTarget,
  ProviderContext,
} from "@/lib/providers/types";
import type { LeadEnrichmentInput } from "@/types/lead";

const log = createLogger("providers.contact.website");

/** Stable synthetic id — the underlying enricher keys its cache on it. */
function targetId(target: ContactTarget): string {
  return `${target.companyDomain ?? target.companyName}|${target.fullName}`
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function createWebsiteContactProvider(): ContactProvider {
  return {
    id: "website-contact",
    displayName: "Company website",
    kind: "contact",
    tier: "free",

    rateLimit: { requestsPerSecond: 4, burst: 8, maxConcurrent: 5 },

    isConfigured: () => true,

    async findContacts(
      target: ContactTarget,
      ctx: ProviderContext
    ): Promise<ContactChannels | null> {
      if (!target.companyDomain && !target.websiteUrl) return null;

      ctx.onProgress?.({
        provider: "website-contact",
        phase: `Finding contact details for ${target.fullName}…`,
      });

      const input: LeadEnrichmentInput = {
        id: targetId(target),
        fullName: target.fullName,
        title: target.title ?? "",
        email: null,
        linkedinUrl: target.linkedinUrl ?? null,
        companyId: target.companyDomain ?? target.companyName,
        companyName: target.companyName,
        companyDomain: target.companyDomain,
        companyCity: null,
        companyState: null,
        companyCountry: null,
        dataProvider: "scraping",
      };

      const details = await enrichContactDetailsFromWebsite(input);

      const found =
        details.email || details.linkedinUrl || details.phone || details.contactPageUrl;
      if (!found) return null;

      log.debug("Website contact resolution finished", {
        person: target.fullName,
        hasEmail: Boolean(details.email),
        hasLinkedIn: Boolean(details.linkedinUrl),
        guessed: details.emailIsGuessed ?? false,
      });

      return {
        email: details.email,
        emailIsGuessed: details.emailIsGuessed ?? false,
        linkedinUrl: details.linkedinUrl,
        phone: details.phone,
        socialProfiles: details.socialProfiles,
        contactPageUrl: details.contactPageUrl,
        confidence: Math.min(1, Math.max(0, (details.confidenceScore ?? 0) / 100)),
      };
    },
  };
}
