import {
  pickPersonalContactEmail,
  sanitizeCompanyLinkedInForCompany,
  sanitizePersonLinkedInForContact,
  sanitizePersonLinkedInUrl,
} from "@/lib/scraping/data-quality";
import { formatEmployeeRange } from "@/lib/scraping/firmographics";
import { computeCompanyFitBreakdown } from "@/lib/scraping/company-fit-breakdown";
import type { CompanyCriteriaFilters } from "@/lib/company-discovery/apply-criteria";
import { validateCompanyForDiscovery } from "@/lib/company-discovery/validate-company";
import type { LeadQualityCategory } from "@/lib/lead-scoring/lead-quality-score";
import type { ContactWithCompany } from "@/lib/contacts/mapper";
import type { ScoredLeadResult } from "@/types/lead-scoring";
import type { DiscoveredCompany } from "@/types/company";
import type { DiscoveredContact } from "@/types/contact";
import type { EmailSource, EnrichedLead, LinkedInSource } from "@/types/lead";
import type { EmailDisplayStatus } from "@/types/email-verification";
import type { VerifiedEmail } from "@/types/email-verification";

/** Step 1 — companies only (no people fields). */
export interface CompanyPublicView {
  id: string;
  name: string;
  website: string | null;
  domain: string | null;
  industry: string | null;
  description: string | null;
  location: string | null;
  country: string | null;
  employeeCount: number | null;
  employeeRange: string | null;
  companyLinkedIn: string | null;
  confidenceScore: number;
  fitScore: number;
  scoreReasons: string[];
  validationWarnings: string[];
}

/** Step 2 — people (LinkedIn from search; email in step 3). */
export interface PersonPublicView {
  id: string;
  fullName: string;
  title: string;
  department: string | null;
  companyName: string;
  companyId: string;
  confidenceScore: number;
  linkedinUrl: string | null;
  sourceUrl: string | null;
  discoverySource: string | null;
  titleMatched?: boolean;
}

/** Step 3 — contact details (email + personal LinkedIn). */
export interface ContactDetailsView {
  id: string;
  fullName: string;
  title: string;
  companyName: string;
  email: string | null;
  emailSource: EmailSource;
  emailIsGuessed: boolean;
  personalLinkedIn: string | null;
  linkedInSource: LinkedInSource;
  contactDetailType: import("@/types/lead").ContactDetailType;
  contactPageUrl: string | null;
  outreachChannel: "email" | "linkedin" | null;
  confidenceScore: number;
  location: string | null;
}

/** Step 4 — email verification row. */
export interface EmailVerificationView {
  contactId: string;
  contactName: string;
  email: string | null;
  displayStatus: EmailDisplayStatus;
  message: string;
}

/** Step 5 — Apollo/Clay-style lead quality output. */
export interface LeadQualityView {
  contactId: string;
  company: {
    name: string;
    website: string | null;
    industry: string | null;
    country: string | null;
    employeeSize: string | null;
  };
  person: {
    fullName: string;
    role: string;
    linkedin: string | null;
    sourceUrl: string | null;
  };
  contact: {
    email: string | null;
    verificationStatus: EmailDisplayStatus | null;
    contactDetailType: import("@/types/lead").ContactDetailType;
    outreachChannel: "email" | "linkedin" | null;
  };
  scores: {
    company: number;
    person: number;
    contact: number;
    overall: number;
    category: LeadQualityCategory;
    legacyScore: number;
  };
  sourceUrls: string[];
}

export function toCompanyPublicView(
  company: DiscoveredCompany,
  filters?: CompanyCriteriaFilters
): CompanyPublicView {
  const locationParts = [company.city, company.state, company.country].filter(Boolean);
  const breakdown = filters
    ? computeCompanyFitBreakdown(company, filters)
    : null;
  const fitScore = breakdown?.overall ?? company.confidenceScore;
  const scoreReasons = breakdown
    ? breakdown.factors
        .filter((f) => f.score > 0)
        .slice(0, 4)
        .map((f) => `${f.label}: ${f.reason}`)
    : [];
  const validation = filters ? validateCompanyForDiscovery(company, filters) : null;

  return {
    id: company.id,
    name: company.name,
    website: company.websiteUrl ?? (company.domain ? `https://${company.domain}` : null),
    domain: company.domain,
    industry: company.industry,
    description: company.description,
    location: locationParts.length > 0 ? locationParts.join(", ") : company.country,
    country: company.country,
    employeeCount: company.employeeCount,
    employeeRange: formatEmployeeRange(company.employeeCount),
    companyLinkedIn: sanitizeCompanyLinkedInForCompany(
      company.linkedinUrl,
      company.name,
      company.domain
    ),
    confidenceScore: company.confidenceScore,
    fitScore,
    scoreReasons,
    validationWarnings: validation?.warnings ?? [],
  };
}

export function toPersonPublicView(contact: DiscoveredContact): PersonPublicView {
  return {
    id: contact.id,
    fullName: contact.fullName,
    title: contact.title,
    department: contact.department,
    companyName: contact.companyName,
    companyId: contact.companyId,
    confidenceScore: contact.confidenceScore,
    linkedinUrl: sanitizePersonLinkedInUrl(contact.linkedinUrl),
    sourceUrl: contact.sourceUrl ?? null,
    discoverySource: contact.discoverySource ?? null,
    titleMatched: contact.titleMatched,
  };
}

export function toContactDetailsView(lead: EnrichedLead): ContactDetailsView {
  const isPublicEmail = lead.contactDetailType === "public_email";
  const emailResult =
    lead.emailSource === "found" && lead.email
      ? isPublicEmail
        ? { email: lead.email, emailIsGuessed: false }
        : pickPersonalContactEmail(lead.name, lead.email)
      : { email: null, emailIsGuessed: false };

  return {
    id: lead.id,
    fullName: lead.name,
    title: lead.role,
    companyName: lead.company,
    email: emailResult.email,
    emailSource: emailResult.email ? "found" : null,
    emailIsGuessed: false,
    personalLinkedIn: sanitizePersonLinkedInForContact(
      lead.linkedin,
      lead.name,
      lead.company
    ),
    linkedInSource: lead.linkedInSource ?? null,
    contactDetailType: lead.contactDetailType ?? null,
    contactPageUrl: lead.contactPageUrl ?? null,
    outreachChannel: lead.outreachChannel ?? null,
    confidenceScore: lead.confidenceScore ?? 0,
    location: lead.location,
  };
}

export function toLeadQualityView(
  contact: ContactWithCompany,
  scored: ScoredLeadResult
): LeadQualityView {
  const company = contact.companies;
  const sourceUrls = [contact.source_url, contact.contact_page_url].filter(
    (url): url is string => Boolean(url)
  );

  return {
    contactId: contact.id,
    company: {
      name: company?.name ?? contact.company_name ?? "Unknown",
      website: company?.website_url ?? (company?.domain ? `https://${company.domain}` : null),
      industry: company?.industry ?? null,
      country: company?.country ?? contact.country,
      employeeSize: formatEmployeeRange(company?.employee_count ?? null),
    },
    person: {
      fullName: contact.full_name,
      role: contact.title,
      linkedin: contact.linkedin_url,
      sourceUrl: contact.source_url,
    },
    contact: {
      email: contact.email,
      verificationStatus:
        (contact.email_display_status as EmailDisplayStatus | null) ?? null,
      contactDetailType:
        (contact.contact_detail_type as import("@/types/lead").ContactDetailType) ??
        null,
      outreachChannel:
        (contact.outreach_channel as "email" | "linkedin" | null) ?? null,
    },
    scores: {
      company: scored.companyScore,
      person: scored.personScore,
      contact: scored.contactScore,
      overall: scored.overallScore,
      category: scored.qualityCategory,
      legacyScore: scored.score,
    },
    sourceUrls,
  };
}

export function emailVerificationUserMessage(
  displayStatus: EmailDisplayStatus,
  email: string | null
): string {
  switch (displayStatus) {
    case "verified":
      return "This email exists and can receive mail.";
    case "likely_valid":
      return "Domain checks out; mailbox not fully confirmed.";
    case "risky":
      return "Domain is valid but mailbox could not be confirmed — outreach at your own risk.";
    case "not_found":
      return "Mailbox does not appear to exist.";
    case "invalid":
      return email
        ? "This email does not appear to exist or is invalid."
        : "No valid email address on file.";
    default:
      return email
        ? "Could not confirm whether this mailbox exists."
        : "No email address to verify.";
  }
}

export function toEmailVerificationView(
  result: VerifiedEmail,
  contactName: string
): EmailVerificationView {
  return {
    contactId: result.contactId,
    contactName,
    email: result.email,
    displayStatus: result.displayStatus,
    message: result.message ?? emailVerificationUserMessage(result.displayStatus, result.email),
  };
}
