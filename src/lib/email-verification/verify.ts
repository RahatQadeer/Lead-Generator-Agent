import { createEmailVerificationProvider } from "@/lib/email-verification/factory";
import { isEmailVerificationError } from "@/lib/email-verification/errors";
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

export async function verifySingleEmail(
  contactId: string,
  email: string | null
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
      provider: provider.name,
      verifiedAt,
      message: "Contact has no email address.",
    };
  }

  const syntax = validateEmailSyntax(email);
  if (!syntax.valid) {
    return {
      contactId,
      email: syntax.normalized,
      syntaxValid: false,
      domainValid: null,
      status: "invalid_syntax",
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
      provider: provider.name,
      verifiedAt,
      message: domain.message,
    };
  }

  const apiResult = await provider.verify(syntax.normalized);

  return {
    contactId,
    email: syntax.normalized,
    syntaxValid: true,
    domainValid: true,
    status: mapApiStatus(apiResult.status),
    provider: provider.name,
    verifiedAt,
    message: apiResult.message,
  };
}

export async function verifyContactEmails(
  inputs: EmailVerificationInput[]
): Promise<EmailVerificationBatchResult> {
  const provider = createEmailVerificationProvider();
  const results: VerifiedEmail[] = [];

  for (const input of inputs) {
    const result = await verifySingleEmail(input.contactId, input.email);
    results.push(result);
  }

  const validCount = results.filter((r) => r.status === "valid").length;
  const invalidCount = results.filter((r) =>
    ["invalid", "invalid_syntax", "invalid_domain"].includes(r.status)
  ).length;
  const riskyCount = results.filter((r) => r.status === "risky").length;
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
      message: "An unexpected error occurred during email verification.",
      retryable: false,
    },
  };
}
