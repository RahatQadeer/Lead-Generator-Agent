export type EmailVerificationStatus =
  | "valid"
  | "invalid"
  | "invalid_syntax"
  | "invalid_domain"
  | "risky"
  | "unknown"
  | "no_email";

export interface EmailVerificationInput {
  contactId: string;
  email: string | null;
}

export interface VerifiedEmail {
  contactId: string;
  email: string | null;
  syntaxValid: boolean;
  domainValid: boolean | null;
  status: EmailVerificationStatus;
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
