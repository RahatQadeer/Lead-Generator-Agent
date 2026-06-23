import { getContactDedupKey } from "@/lib/contact-discovery/apply-dedup";
import { formatLocation } from "@/lib/lead-enrichment/format-location";
import {
  isGenericCompanyEmail,
  isPlaceholderEmail,
  pickPersonalContactEmail,
  sanitizePersonLinkedInForContact,
  sanitizePersonLinkedInUrl,
} from "@/lib/scraping/data-quality";
import type { Database, Json } from "@/types/database";
import type { DiscoveredContact } from "@/types/contact";
import type { EmailVerificationStatus, EmailVerificationInput } from "@/types/email-verification";
import type { VerifiedEmail } from "@/types/email-verification";
import type { EnrichedLead, LeadEnrichmentInput, LinkedInSource } from "@/types/lead";
import type { LeadScoringInput } from "@/types/lead-scoring";
import type { LeadScoreFactors } from "@/types/lead-scoring";
import type { ScoredLeadResult } from "@/types/lead-scoring";

type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

export type ContactWithCompany = ContactRow & {
  companies: Pick<
    CompanyRow,
    | "name"
    | "city"
    | "state"
    | "country"
    | "industry"
    | "description"
    | "employee_count"
    | "technologies"
    | "domain"
    | "website_url"
  > | null;
};

function resolveDiscoveredLinkedIn(contact: DiscoveredContact): {
  linkedinUrl: string | null;
  linkedInSource: LinkedInSource;
} {
  const linkedinUrl =
    sanitizePersonLinkedInForContact(
      contact.linkedinUrl,
      contact.fullName,
      contact.companyName
    ) ?? sanitizePersonLinkedInUrl(contact.linkedinUrl);

  if (!linkedinUrl) {
    return { linkedinUrl: null, linkedInSource: null };
  }

  const linkedInSource: LinkedInSource =
    contact.discoverySource === "linkedin_search" ||
    contact.discoverySource === "wikidata" ||
    contact.discoverySource === "directory_listing"
      ? "public_profile"
      : "website";

  return { linkedinUrl, linkedInSource };
}

export function toContactInsertCore(
  userId: string,
  searchId: string,
  provider: string,
  contact: DiscoveredContact
): ContactInsert | null {
  const dedupKey = getContactDedupKey(contact);
  if (!dedupKey) return null;

  const { linkedinUrl } = resolveDiscoveredLinkedIn(contact);

  return {
    user_id: userId,
    company_id: contact.companyId,
    search_id: searchId,
    dedup_key: dedupKey,
    provider,
    provider_contact_id: contact.id,
    first_name: contact.firstName?.trim() || "Unknown",
    last_name: contact.lastName,
    full_name: contact.fullName?.trim() || contact.firstName?.trim() || "Unknown",
    title: contact.title?.trim() || "Team Member",
    email: null,
    linkedin_url: linkedinUrl,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function toContactInsertExtended(
  contact: DiscoveredContact
): Partial<ContactInsert> {
  const { linkedInSource } = resolveDiscoveredLinkedIn(contact);

  return {
    department: contact.department,
    confidence_score: contact.confidenceScore,
    email_is_guessed: false,
    email_source: null,
    linkedin_source: linkedInSource,
    outreach_channel: null,
    discarded_at: null,
    enriched_at: null,
    enrichment_provider: null,
    scraped_at: new Date().toISOString(),
    source_url: contact.sourceUrl ?? null,
    discovery_source: contact.discoverySource ?? null,
    contact_page_url: null,
    contact_detail_type: null,
  };
}

export function toContactInsert(
  userId: string,
  searchId: string,
  provider: string,
  contact: DiscoveredContact
): ContactInsert | null {
  const core = toContactInsertCore(userId, searchId, provider, contact);
  if (!core) return null;

  return {
    ...core,
    ...toContactInsertExtended(contact),
  };
}

export function toLeadEnrichmentInput(
  contact: ContactWithCompany,
  searchIndustry?: string
): LeadEnrichmentInput {
  const company = contact.companies;

  return {
    id: contact.id,
    fullName: contact.full_name,
    title: contact.title?.trim() || "Team Member",
    email: contact.email,
    linkedinUrl: contact.linkedin_url,
    linkedInSource: (contact.linkedin_source as LinkedInSource) ?? null,
    emailIsGuessed: contact.email_is_guessed ?? false,
    companyId: contact.company_id,
    companyName: company?.name ?? contact.company_name ?? "Unknown",
    companyDomain: company?.domain ?? null,
    companyIndustry: company?.industry ?? null,
    companyDescription: company?.description ?? null,
    targetIndustry: searchIndustry ?? "",
    companyCity: company?.city ?? contact.city,
    companyState: company?.state ?? contact.state,
    companyCountry: company?.country ?? contact.country,
    providerContactId: contact.provider_contact_id,
    dataProvider: contact.provider,
  };
}

/** Email validated in step 3 — only real found emails (never pattern guesses). */
function resolveEnrichedEmailForSave(lead: EnrichedLead): string | null {
  if (lead.emailSource !== "found" || !lead.email?.trim()) return null;

  const normalized = lead.email.trim().toLowerCase();
  if (isPlaceholderEmail(normalized)) return null;

  if (lead.contactDetailType === "public_email") {
    return normalized;
  }

  if (isGenericCompanyEmail(normalized)) return null;
  return normalized;
}

/** Email stored on a contact row for step 4 verification. */
function resolveStoredContactEmail(contact: ContactWithCompany): string | null {
  const raw = contact.email?.trim().toLowerCase();
  if (!raw) return null;

  // Trust emails persisted from step 3 enrichment
  if (
    contact.email_source === "found" ||
    contact.email_source === "predicted" ||
    (contact.enriched_at && !contact.email_is_guessed)
  ) {
    if (isPlaceholderEmail(raw)) return null;
    if (contact.contact_detail_type === "public_email") return raw;
    if (isGenericCompanyEmail(raw)) return null;
    return raw;
  }

  return pickPersonalContactEmail(contact.full_name, raw).email;
}

export function toEnrichedLeadUpdateCore(
  lead: EnrichedLead,
  provider: string
): Database["public"]["Tables"]["contacts"]["Update"] {
  return {
    full_name: lead.name,
    title: lead.role,
    company_name: lead.company,
    linkedin_url: sanitizePersonLinkedInForContact(
      lead.linkedin,
      lead.name,
      lead.company
    ),
    email: resolveEnrichedEmailForSave(lead),
    city: lead.city,
    state: lead.state,
    country: lead.country,
    enriched_at: lead.enrichedAt,
    enrichment_provider: provider,
    updated_at: new Date().toISOString(),
  };
}

export function toEnrichedLeadUpdateExtended(
  lead: EnrichedLead
): Database["public"]["Tables"]["contacts"]["Update"] {
  return {
    email_is_guessed: lead.emailIsGuessed ?? false,
    email_source:
      lead.emailSource === "found"
        ? "found"
        : lead.emailSource === "predicted"
          ? "predicted"
          : null,
    linkedin_source: lead.linkedInSource,
    confidence_score: lead.confidenceScore,
    outreach_channel: lead.outreachChannel,
    discarded_at: null,
    contact_page_url: lead.contactPageUrl,
    contact_detail_type: lead.contactDetailType,
  };
}

export function toEnrichedLeadUpdate(
  lead: EnrichedLead,
  provider: string
): Database["public"]["Tables"]["contacts"]["Update"] {
  return {
    ...toEnrichedLeadUpdateCore(lead, provider),
    ...toEnrichedLeadUpdateExtended(lead),
  };
}

export function toEnrichedLead(contact: ContactRow): EnrichedLead | null {
  if (!contact.enriched_at) return null;

  return {
    id: contact.id,
    name: contact.full_name,
    role: contact.title,
    company: contact.company_name ?? "Unknown",
    linkedin: contact.linkedin_url,
    city: contact.city,
    state: contact.state,
    country: contact.country,
    location: formatLocation(contact.city, contact.state, contact.country),
    email: contact.email,
    emailSyntaxValid: contact.email_syntax_valid,
    emailDomainValid: contact.email_domain_valid,
    emailVerificationStatus:
      (contact.email_verification_status as EmailVerificationStatus | null) ?? null,
    emailVerifiedAt: contact.email_verified_at,
    leadScore: contact.lead_score,
    leadScoreFactors:
      (contact.lead_score_factors as LeadScoreFactors | null) ?? null,
    leadScoredAt: contact.lead_scored_at,
    intentScore: contact.intent_score,
    intentSignals:
      (contact.intent_signals as import("@/types/intent-signals").IntentSignal[] | null) ??
      null,
    confidenceScore: contact.confidence_score ?? 0,
    emailSource: (contact.email_source as EnrichedLead["emailSource"]) ?? null,
    linkedInSource: (contact.linkedin_source as EnrichedLead["linkedInSource"]) ?? null,
    contactDetailType:
      (contact.contact_detail_type as EnrichedLead["contactDetailType"]) ?? null,
    contactPageUrl: contact.contact_page_url ?? null,
    outreachChannel:
      (contact.outreach_channel as EnrichedLead["outreachChannel"]) ?? null,
    companyId: contact.company_id,
    searchId: contact.search_id,
    enrichedAt: contact.enriched_at,
    followUpsPaused: contact.follow_ups_paused ?? false,
    followUpsPausedReason: contact.follow_ups_paused_reason,
  };
}

export function toEmailVerificationUpdate(
  result: VerifiedEmail
): Database["public"]["Tables"]["contacts"]["Update"] {
  const verified = result.status === "valid" && Boolean(result.email?.trim());

  return {
    email: result.email,
    email_syntax_valid: result.syntaxValid,
    email_domain_valid: result.domainValid,
    email_verification_status: result.status,
    email_display_status: result.displayStatus,
    email_verification_provider: result.provider,
    email_verification_message: result.message,
    email_verified_at: result.verifiedAt,
    contact_detail_type: verified ? "verified_email" : undefined,
    updated_at: new Date().toISOString(),
  };
}

export function toEmailVerificationInput(
  contact: ContactWithCompany
): EmailVerificationInput & { emailIsGuessed?: boolean; trustedEmail?: boolean } {
  const email = resolveStoredContactEmail(contact);
  const trustedEmail = Boolean(
    email &&
      (contact.email_source === "found" ||
        (contact.enriched_at && !contact.email_is_guessed))
  );

  return {
    contactId: contact.id,
    email,
    emailIsGuessed: contact.email_is_guessed ?? contact.email_source === "predicted",
    contactName: contact.full_name,
    trustedEmail,
  };
}

export function toLeadScoringInput(contact: ContactWithCompany): LeadScoringInput {
  const company = contact.companies;

  return {
    contactId: contact.id,
    role: contact.title,
    email: contact.email,
    emailSource: (contact.email_source as LeadScoringInput["emailSource"]) ?? null,
    linkedinUrl: contact.linkedin_url,
    linkedInSource:
      (contact.linkedin_source as LeadScoringInput["linkedInSource"]) ?? null,
    emailDisplayStatus:
      (contact.email_display_status as LeadScoringInput["emailDisplayStatus"]) ??
      null,
    company: {
      name: company?.name ?? contact.company_name ?? "Unknown",
      domain: company?.domain ?? null,
      industry: company?.industry ?? null,
      description: company?.description ?? null,
      employeeCount: company?.employee_count ?? null,
      country: company?.country ?? contact.country,
      websiteUrl: company?.website_url ?? null,
      technologies: company?.technologies ?? [],
    },
  };
}

export function toLeadScoreUpdate(
  result: ScoredLeadResult
): Database["public"]["Tables"]["contacts"]["Update"] {
  return {
    lead_score: result.score,
    lead_score_factors: result.factors,
    lead_scored_at: result.scoredAt,
    confidence_score: result.confidenceScore,
    intent_score: result.intentScore ?? null,
    intent_signals: (result.intentSignals ?? null) as Json,
    updated_at: new Date().toISOString(),
  };
}
