import { EmailVerificationError } from "@/lib/email-verification/errors";
import { DnsEmailVerificationProvider } from "@/lib/email-verification/dns-verifier";
import { HunterEmailVerificationProvider } from "@/lib/email-verification/hunter-verifier";
import { MockEmailVerificationProvider } from "@/lib/email-verification/mock-verifier";
import type { EmailVerificationApiProvider } from "@/lib/email-verification/types";
import { isPaidApisDisabled } from "@/lib/providers/free-stack";

export type EmailVerificationProviderName = "mock" | "dns" | "hunter";

export function getConfiguredEmailVerificationProviderName(): EmailVerificationProviderName {
  const provider = process.env.EMAIL_VERIFICATION_PROVIDER?.toLowerCase();

  if (
    provider === "hunter" &&
    process.env.HUNTER_API_KEY &&
    !isPaidApisDisabled()
  ) {
    return "hunter";
  }

  if (provider === "dns") {
    return "dns";
  }

  if (provider === "mock") {
    return "mock";
  }

  return "dns";
}

export function createEmailVerificationProvider(): EmailVerificationApiProvider {
  const providerName = getConfiguredEmailVerificationProviderName();

  if (providerName === "hunter") {
    if (isPaidApisDisabled()) {
      return new DnsEmailVerificationProvider();
    }
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

  if (providerName === "dns") {
    return new DnsEmailVerificationProvider();
  }

  return new MockEmailVerificationProvider();
}
