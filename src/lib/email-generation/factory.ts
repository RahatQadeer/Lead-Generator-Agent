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

export function createEmailGenerationProviderFromConfig(input: {
  provider: EmailGenerationProviderName;
  apiKey: string | null;
  model: string;
}): EmailGenerationProvider {
  if (input.provider === "openai") {
    if (!input.apiKey) {
      throw new EmailGenerationError(
        "PROVIDER_NOT_CONFIGURED",
        "OpenAI API key is not configured. Add your key in Settings or set OPENAI_API_KEY.",
        { statusCode: 500, retryable: false }
      );
    }
    return new OpenAIEmailGenerationProvider(input.apiKey, input.model);
  }

  return new MockEmailGenerationProvider();
}

export function createEmailGenerationProvider(): EmailGenerationProvider {
  return createEmailGenerationProviderFromConfig({
    provider: getConfiguredEmailProviderName(),
    apiKey: process.env.OPENAI_API_KEY ?? null,
    model: getOpenAIModel(),
  });
}
