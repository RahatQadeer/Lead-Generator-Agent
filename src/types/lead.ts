import type { EmailVerificationStatus } from "@/types/email-verification";
import type { LeadScoreFactors } from "@/types/lead-scoring";

export type EmailSource = "found" | "predicted" | null;
export type LinkedInSource = "website" | "public_profile" | "pdl" | null;
export type ContactDetailType =
  | "verified_email"
  | "public_email"
  | "linkedin_only"
  | "contact_page_only"
  | null;
export type OutreachChannel = "email" | "linkedin";

export interface LeadEnrichmentInput {
  id: string;
  fullName: string;
  title: string;
  email: string | null;
  linkedinUrl: string | null;
  emailIsGuessed?: boolean;
  companyId: string;
  companyName: string;
  companyDomain: string | null;
  companyIndustry?: string | null;
  companyDescription?: string | null;
  targetIndustry?: string;
  companyCity: string | null;
  companyState: string | null;
  companyCountry: string | null;
  /** PDL person id or other provider-side contact id from step 2. */
  providerContactId?: string | null;
  /** Discovery provider name (e.g. pdl, scraping). */
  dataProvider?: string | null;
}

export interface EnrichedLead {
  id: string;
  name: string;
  role: string;
  company: string;
  linkedin: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  email: string | null;
  emailIsGuessed?: boolean;
  emailSyntaxValid: boolean | null;
  emailDomainValid: boolean | null;
  emailVerificationStatus: EmailVerificationStatus | null;
  emailVerifiedAt: string | null;
  leadScore: number | null;
  leadScoreFactors: LeadScoreFactors | null;
  leadScoredAt: string | null;
  intentScore: number | null;
  intentSignals: import("@/types/intent-signals").IntentSignal[] | null;
  companyId: string;
  searchId: string | null;
  enrichedAt: string;
  confidenceScore: number;
  emailSource: EmailSource;
  linkedInSource: LinkedInSource;
  contactDetailType: ContactDetailType;
  contactPageUrl: string | null;
  outreachChannel: OutreachChannel | null;
  followUpsPaused: boolean;
  followUpsPausedReason: string | null;
}

export interface LeadEnrichmentResult {
  leads: EnrichedLead[];
  provider: string;
  enrichedCount: number;
  skippedCount: number;
  discardedCount: number;
}
