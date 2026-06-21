import { EmailGenerationError } from "@/lib/email-generation/errors";
import {
  getConfiguredEmailProviderName,
  getOpenAIModel,
} from "@/lib/email-generation/factory";
import { MockFollowUpGenerationProvider } from "@/lib/follow-up-generation/mock-provider";
import { OpenAIFollowUpGenerationProvider } from "@/lib/follow-up-generation/openai-provider";
import type { FollowUpGenerationProvider } from "@/lib/follow-up-generation/types";

export function createFollowUpGenerationProvider(): FollowUpGenerationProvider {
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
    return new OpenAIFollowUpGenerationProvider(apiKey, getOpenAIModel());
  }

  return new MockFollowUpGenerationProvider();
}
