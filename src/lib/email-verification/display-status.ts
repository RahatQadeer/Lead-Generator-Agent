import type { EmailDisplayStatus } from "@/types/email-verification";
import type { SmtpCheckResult } from "@/lib/email-verification/smtp-safe-verifier";

export function toEmailDisplayStatus(input: {
  syntaxValid: boolean;
  domainValid: boolean | null;
  smtpResult: SmtpCheckResult | null;
  emailIsGuessed?: boolean;
}): EmailDisplayStatus {
  if (!input.syntaxValid) return "invalid";
  if (input.domainValid === false) return "invalid";

  if (input.emailIsGuessed) {
    if (input.smtpResult === "verified") return "likely_valid";
    if (input.domainValid) return "risky";
    return "unknown";
  }

  if (input.smtpResult === "verified") return "verified";
  if (input.smtpResult === "invalid") return "invalid";
  if (input.smtpResult === "likely_valid" && input.domainValid) return "likely_valid";
  if (input.domainValid) return "likely_valid";
  return "not_found";
}

export function emailDisplayLabel(status: EmailDisplayStatus | null | undefined): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "likely_valid":
      return "Likely Valid";
    case "risky":
      return "Risky";
    case "invalid":
      return "Invalid";
    case "not_found":
      return "Not Found";
    default:
      return "Unknown";
  }
}

export function isEmailSafeToDisplay(status: EmailDisplayStatus | null | undefined): boolean {
  return status === "verified" || status === "likely_valid";
}
