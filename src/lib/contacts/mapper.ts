import { getContactDedupKey } from "@/lib/contact-discovery/apply-dedup";
import { formatLocation } from "@/lib/lead-enrichment/format-location";
import type { Database } from "@/types/database";
import type { DiscoveredContact } from "@/types/contact";
import type { EmailVerificationStatus } from "@/types/email-verification";
import type { VerifiedEmail } from "@/types/email-verification";
import type { EnrichedLead, LeadEnrichmentInput } from "@/types/lead";
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
    | "employee_count"
    | "technologies"
    | "domain"
    | "website_url"
  > | null;
};

export function toContactInsert(
  userId: string,
  searchId: string,
  provider: string,
  contact: DiscoveredContact
): ContactInsert | null {
  const dedupKey = getContactDedupKey(contact);
  if (!dedupKey) return null;

  return {
    user_id: userId,
    company_id: contact.companyId,
    search_id: searchId,
    dedup_key: dedupKey,
    provider,
    provider_contact_id: contact.id,
    first_name: contact.firstName,
    last_name: contact.lastName,
    full_name: contact.fullName,
    title: contact.title,
    email: contact.email,
    linkedin_url: contact.linkedinUrl,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function toLeadEnrichmentInput(
  contact: ContactWithCompany
): LeadEnrichmentInput {
  const company = contact.companies;

  return {
    id: contact.id,
    fullName: contact.full_name,
    title: contact.title,
    email: contact.email,
    linkedinUrl: contact.linkedin_url,
    companyId: contact.company_id,
    companyName: company?.name ?? contact.company_name ?? "Unknown",
    companyCity: company?.city ?? contact.city,
    companyState: company?.state ?? contact.state,
    companyCountry: company?.country ?? contact.country,
  };
}

export function toEnrichedLeadUpdate(
  lead: EnrichedLead,
  provider: string
): Database["public"]["Tables"]["contacts"]["Update"] {
  return {
    full_name: lead.name,
    title: lead.role,
    company_name: lead.company,
    linkedin_url: lead.linkedin,
    city: lead.city,
    state: lead.state,
    country: lead.country,
    enriched_at: lead.enrichedAt,
    enrichment_provider: provider,
    updated_at: new Date().toISOString(),
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
  return {
    email: result.email,
    email_syntax_valid: result.syntaxValid,
    email_domain_valid: result.domainValid,
    email_verification_status: result.status,
    email_verification_provider: result.provider,
    email_verification_message: result.message,
    email_verified_at: result.verifiedAt,
    updated_at: new Date().toISOString(),
  };
}

export function toEmailVerificationInput(
  contact: ContactWithCompany
): { contactId: string; email: string | null } {
  return {
    contactId: contact.id,
    email: contact.email,
  };
}

export function toLeadScoringInput(contact: ContactWithCompany): LeadScoringInput {
  const company = contact.companies;

  return {
    contactId: contact.id,
    role: contact.title,
    company: {
      name: company?.name ?? contact.company_name ?? "Unknown",
      domain: company?.domain ?? null,
      industry: company?.industry ?? null,
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
    updated_at: new Date().toISOString(),
  };
}
