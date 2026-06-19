import { EmailGenerationError } from "@/lib/email-generation/errors";
import { MockEmailGenerationProvider } from "@/lib/email-generation/mock-provider";
import { OpenAIEmailGenerationProvider } from "@/lib/email-generation/openai-provider";
import {
  getDefaultOpenRouterModel,
  OpenRouterEmailGenerationProvider,
} from "@/lib/email-generation/openrouter-provider";
import type { EmailGenerationProvider } from "@/lib/email-generation/types";
import { isPaidApisDisabled } from "@/lib/providers/free-stack";

export type EmailGenerationProviderName = "mock" | "openai" | "openrouter";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export function getConfiguredEmailProviderName(): EmailGenerationProviderName {
  const provider = process.env.EMAIL_GENERATION_PROVIDER?.toLowerCase();

  if (
    provider === "openai" &&
    process.env.OPENAI_API_KEY &&
    !isPaidApisDisabled()
  ) {
    return "openai";
  }

  if (provider === "openrouter" && process.env.OPENROUTER_API_KEY) {
    return "openrouter";
  }

  if (provider === "openai" && isPaidApisDisabled() && process.env.OPENROUTER_API_KEY) {
    return "openrouter";
  }

  if (provider === "mock") {
    return "mock";
  }

  return "mock";
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export function getOpenRouterModel(): string {
  return getDefaultOpenRouterModel();
}

export function createEmailGenerationProviderFromConfig(input: {
  provider: EmailGenerationProviderName;
  apiKey: string | null;
  model: string;
}): EmailGenerationProvider {
  if (input.provider === "openrouter") {
    if (!input.apiKey) {
      throw new EmailGenerationError(
        "PROVIDER_NOT_CONFIGURED",
        "OpenRouter API key is not configured. Set OPENROUTER_API_KEY.",
        { statusCode: 500, retryable: false }
      );
    }
    return new OpenRouterEmailGenerationProvider(input.apiKey, input.model);
  }

  if (input.provider === "openai") {
    if (isPaidApisDisabled()) {
      if (process.env.OPENROUTER_API_KEY) {
        return new OpenRouterEmailGenerationProvider(
          process.env.OPENROUTER_API_KEY,
          getDefaultOpenRouterModel()
        );
      }
      return new MockEmailGenerationProvider();
    }
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
  const provider = getConfiguredEmailProviderName();

  if (provider === "openrouter") {
    return createEmailGenerationProviderFromConfig({
      provider,
      apiKey: process.env.OPENROUTER_API_KEY ?? null,
      model: getOpenRouterModel(),
    });
  }

  return createEmailGenerationProviderFromConfig({
    provider,
    apiKey: process.env.OPENAI_API_KEY ?? null,
    model: getOpenAIModel(),
  });
}
