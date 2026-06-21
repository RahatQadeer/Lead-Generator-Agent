import { createFollowUpGenerationProviderFromConfig } from "@/lib/follow-up-generation/factory";
import { isEmailGenerationError } from "@/lib/email-generation/errors";
import { resolveEmailGenerationConfig } from "@/lib/openai/settings";
import { withRetry } from "@/lib/email-generation/retry";
import type {
  FollowUpGenerationContext,
  FollowUpSuggestionResult,
} from "@/types/follow-up-suggestion";

export async function generateFollowUpSuggestion(
  userId: string,
  context: FollowUpGenerationContext
): Promise<FollowUpSuggestionResult> {
  const config = await resolveEmailGenerationConfig(userId);
  const provider = createFollowUpGenerationProviderFromConfig(config);

  const { result, attempts } = await withRetry(
    async () => provider.generate(context),
    { maxAttempts: 3, baseDelayMs: 600, maxDelayMs: 5000 }
  );

  return { ...result, attempts };
}

export function toFollowUpGenerationErrorResponse(error: unknown) {
  if (isEmailGenerationError(error)) {
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
      message: "Something went wrong while writing the follow-up. Please try again.",
      retryable: false,
    },
  };
}
