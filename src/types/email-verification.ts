export type EmailVerificationStatus =
  | "valid"
  | "invalid"
  | "invalid_syntax"
  | "invalid_domain"
  | "risky"
  | "unknown"
  | "no_email";

/** User-facing verification tier shown in the UI. */
export type EmailDisplayStatus =
  | "verified"
  | "likely_valid"
  | "risky"
  | "invalid"
  | "not_found"
  | "unknown";

export interface EmailVerificationInput {
  contactId: string;
  email: string | null;
  contactName?: string;
}

export interface VerifiedEmail {
  contactId: string;
  email: string | null;
  syntaxValid: boolean;
  domainValid: boolean | null;
  status: EmailVerificationStatus;
  displayStatus: EmailDisplayStatus;
  provider: string;
  verifiedAt: string;
  message: string | null;
}

export interface EmailVerificationBatchResult {
  results: VerifiedEmail[];
  provider: string;
  validCount: number;
  invalidCount: number;
  riskyCount: number;
  skippedCount: number;
}
