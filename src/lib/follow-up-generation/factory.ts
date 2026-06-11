import {
  createEmailGenerationProviderFromConfig,
  type EmailGenerationProviderName,
} from "@/lib/email-generation/factory";
import { MockFollowUpGenerationProvider } from "@/lib/follow-up-generation/mock-provider";
import { OpenAIFollowUpGenerationProvider } from "@/lib/follow-up-generation/openai-provider";
import type { FollowUpGenerationProvider } from "@/lib/follow-up-generation/types";

export function createFollowUpGenerationProviderFromConfig(input: {
  provider: EmailGenerationProviderName;
  apiKey: string | null;
  model: string;
}): FollowUpGenerationProvider {
  const emailProvider = createEmailGenerationProviderFromConfig(input);

  if (emailProvider.name === "openai") {
    return new OpenAIFollowUpGenerationProvider(
      input.apiKey as string,
      input.model
    );
  }

  return new MockFollowUpGenerationProvider();
}
