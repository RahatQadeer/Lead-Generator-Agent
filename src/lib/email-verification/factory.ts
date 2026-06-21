import { EmailVerificationError } from "@/lib/email-verification/errors";
import { HunterEmailVerificationProvider } from "@/lib/email-verification/hunter-verifier";
import { MockEmailVerificationProvider } from "@/lib/email-verification/mock-verifier";
import type { EmailVerificationApiProvider } from "@/lib/email-verification/types";

export type EmailVerificationProviderName = "mock" | "hunter";

export function getConfiguredEmailVerificationProviderName(): EmailVerificationProviderName {
  const provider = process.env.EMAIL_VERIFICATION_PROVIDER?.toLowerCase();

  if (provider === "hunter" && process.env.HUNTER_API_KEY) {
    return "hunter";
  }

  return "mock";
}

export function createEmailVerificationProvider(): EmailVerificationApiProvider {
  const providerName = getConfiguredEmailVerificationProviderName();

  if (providerName === "hunter") {
    const apiKey = process.env.HUNTER_API_KEY;
    if (!apiKey) {
      throw new EmailVerificationError(
        "PROVIDER_NOT_CONFIGURED",
        "Hunter API key is not configured. Set HUNTER_API_KEY in your environment.",
        { statusCode: 500, retryable: false }
      );
    }
    return new HunterEmailVerificationProvider(apiKey);
  }

  return new MockEmailVerificationProvider();
}
