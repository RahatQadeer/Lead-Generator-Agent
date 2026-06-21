import type {
  ApiVerificationResult,
  EmailVerificationApiProvider,
} from "@/lib/email-verification/types";

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "throwaway.email",
]);

export class MockEmailVerificationProvider implements EmailVerificationApiProvider {
  readonly name = "mock";

  async verify(email: string): Promise<ApiVerificationResult> {
    await new Promise((r) => setTimeout(r, 150));

    const [localPart, domain] = email.split("@");

    if (!localPart || !domain) {
      return { status: "invalid", message: "Malformed email address." };
    }

    if (localPart.startsWith("invalid") || localPart.includes("bounce")) {
      return {
        status: "invalid",
        message: "Mailbox does not exist (mock).",
      };
    }

    if (
      localPart.startsWith("risky") ||
      localPart.startsWith("catchall") ||
      domain.startsWith("catchall.")
    ) {
      return {
        status: "risky",
        message: "Catch-all or unverifiable mailbox (mock).",
      };
    }

    if (DISPOSABLE_DOMAINS.has(domain) || localPart.startsWith("disposable")) {
      return {
        status: "invalid",
        message: "Disposable email address (mock).",
      };
    }

    if (localPart.startsWith("unknown")) {
      return {
        status: "unknown",
        message: "Verification inconclusive (mock).",
      };
    }

    return { status: "valid", message: "Email is deliverable (mock)." };
  }
}
