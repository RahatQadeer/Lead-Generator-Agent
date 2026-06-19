import { createEmailVerificationProvider } from "@/lib/email-verification/factory";
import { isEmailVerificationError } from "@/lib/email-verification/errors";
import { toEmailDisplayStatus } from "@/lib/email-verification/display-status";
import { pickPersonalContactEmail } from "@/lib/scraping/data-quality";
import { verifyEmailSmtpSafe } from "@/lib/email-verification/smtp-safe-verifier";
import { validateEmailDomain } from "@/lib/email-verification/validate-domain";
import { validateEmailSyntax } from "@/lib/email-verification/validate-syntax";
import type { ApiVerificationStatus } from "@/lib/email-verification/types";
import type {
  EmailVerificationBatchResult,
  EmailVerificationInput,
  EmailVerificationStatus,
  VerifiedEmail,
} from "@/types/email-verification";

function mapApiStatus(status: ApiVerificationStatus): EmailVerificationStatus {
  if (status === "valid") return "valid";
  if (status === "invalid") return "invalid";
  if (status === "risky") return "risky";
  return "unknown";
}

const SMTP_ENABLED = process.env.EMAIL_SMTP_VERIFY_ENABLED !== "false";

export async function verifySingleEmail(
  contactId: string,
  email: string | null,
  options: {
    emailIsGuessed?: boolean;
    contactName?: string;
    trustedEmail?: boolean;
  } = {}
): Promise<VerifiedEmail> {
  const verifiedAt = new Date().toISOString();
  const provider = createEmailVerificationProvider();
  const useMockDomainRules = provider.name === "mock";

  if (!email?.trim()) {
    return {
      contactId,
      email: null,
      syntaxValid: false,
      domainValid: null,
      status: "no_email",
      displayStatus: "unknown",
      provider: provider.name,
      verifiedAt,
      message: "No personal email on file. Run step 3 (Add contact details) first.",
    };
  }

  const personal =
    options.trustedEmail && email?.trim()
      ? { email: email.trim().toLowerCase(), emailIsGuessed: false }
      : options.contactName
        ? pickPersonalContactEmail(options.contactName, email, {
            allowGuessed: options.emailIsGuessed,
          })
        : {
            email: email.trim().toLowerCase(),
            emailIsGuessed: options.emailIsGuessed ?? false,
          };

  if (!personal.email) {
    return {
      contactId,
      email: null,
      syntaxValid: false,
      domainValid: null,
      status: "no_email",
      displayStatus: "invalid",
      provider: provider.name,
      verifiedAt,
      message: "Not a personal email address (generic or company inbox rejected).",
    };
  }

  const emailToVerify = personal.email;
  const syntax = validateEmailSyntax(emailToVerify);
  if (!syntax.valid) {
    return {
      contactId,
      email: syntax.normalized,
      syntaxValid: false,
      domainValid: null,
      status: "invalid_syntax",
      displayStatus: "invalid",
      provider: provider.name,
      verifiedAt,
      message: syntax.message,
    };
  }

  const domain = await validateEmailDomain(syntax.normalized, {
    useMockRules: useMockDomainRules,
  });

  if (!domain.valid) {
    return {
      contactId,
      email: syntax.normalized,
      syntaxValid: true,
      domainValid: false,
      status: "invalid_domain",
      displayStatus: "invalid",
      provider: provider.name,
      verifiedAt,
      message: domain.message,
    };
  }

  let smtpResult: Awaited<ReturnType<typeof verifyEmailSmtpSafe>> | null = null;
  if (SMTP_ENABLED && provider.name === "dns") {
    try {
      smtpResult = await verifyEmailSmtpSafe(syntax.normalized);
    } catch {
      smtpResult = "unknown";
    }
  }

  const apiResult = await provider.verify(syntax.normalized);
  const status = mapApiStatus(apiResult.status);

  const displayStatus = toEmailDisplayStatus({
    syntaxValid: true,
    domainValid: true,
    smtpResult,
    emailIsGuessed: personal.emailIsGuessed,
  });

  const userMessage =
    displayStatus === "verified"
      ? "Email exists — mailbox confirmed."
      : displayStatus === "likely_valid"
        ? "Domain is valid — mailbox likely exists."
        : displayStatus === "risky"
          ? "Domain valid but mailbox unconfirmed — use with caution."
          : displayStatus === "not_found"
            ? "Mailbox could not be found."
            : displayStatus === "invalid"
              ? "Email does not exist or is invalid."
              : "Could not confirm if this mailbox exists.";

  return {
    contactId,
    email: syntax.normalized,
    syntaxValid: true,
    domainValid: true,
    status,
    displayStatus,
    provider: provider.name,
    verifiedAt,
    message: userMessage,
  };
}

export async function verifyContactEmails(
  inputs: (EmailVerificationInput & {
    emailIsGuessed?: boolean;
    trustedEmail?: boolean;
  })[]
): Promise<EmailVerificationBatchResult> {
  const provider = createEmailVerificationProvider();
  const results: VerifiedEmail[] = [];

  for (const input of inputs) {
    const result = await verifySingleEmail(input.contactId, input.email, {
      emailIsGuessed: input.emailIsGuessed,
      contactName: input.contactName,
      trustedEmail: input.trustedEmail,
    });
    results.push(result);
  }

  const validCount = results.filter((r) => r.displayStatus === "verified").length;
  const invalidCount = results.filter((r) =>
    ["invalid", "invalid_syntax", "invalid_domain"].includes(r.status)
  ).length;
  const riskyCount = results.filter(
    (r) => r.displayStatus === "likely_valid" || r.displayStatus === "risky"
  ).length;
  const skippedCount = results.filter((r) => r.status === "no_email").length;

  return {
    results,
    provider: provider.name,
    validCount,
    invalidCount,
    riskyCount,
    skippedCount,
  };
}

export function toEmailVerificationErrorResponse(error: unknown) {
  if (isEmailVerificationError(error)) {
    return {
      success: false as const,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    };
  }

  return {
    success: false as const,
    error: {
      code: "PROVIDER_ERROR" as const,
      message: "Something went wrong while verifying emails. Please try again.",
      retryable: false,
    },
  };
}
