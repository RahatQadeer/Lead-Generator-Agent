import { EmailGenerationError } from "@/lib/email-generation/errors";
import { MockEmailGenerationProvider } from "@/lib/email-generation/mock-provider";
import { OpenAIEmailGenerationProvider } from "@/lib/email-generation/openai-provider";
import type { EmailGenerationProvider } from "@/lib/email-generation/types";

export type EmailGenerationProviderName = "mock" | "openai";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export function getConfiguredEmailProviderName(): EmailGenerationProviderName {
  const provider = process.env.EMAIL_GENERATION_PROVIDER?.toLowerCase();

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return "openai";
  }

  return "mock";
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export function createEmailGenerationProvider(): EmailGenerationProvider {
  const providerName = getConfiguredEmailProviderName();

  if (providerName === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new EmailGenerationError(
        "PROVIDER_NOT_CONFIGURED",
        "OpenAI API key is not configured. Set OPENAI_API_KEY in your environment.",
        { statusCode: 500, retryable: false }
      );
    }
    return new OpenAIEmailGenerationProvider(apiKey, getOpenAIModel());
  }

  return new MockEmailGenerationProvider();
}
