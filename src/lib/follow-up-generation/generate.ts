import { createFollowUpGenerationProvider } from "@/lib/follow-up-generation/factory";
import { isEmailGenerationError } from "@/lib/email-generation/errors";
import { withRetry } from "@/lib/email-generation/retry";
import type {
  FollowUpGenerationContext,
  FollowUpSuggestionResult,
} from "@/types/follow-up-suggestion";

export async function generateFollowUpSuggestion(
  context: FollowUpGenerationContext
): Promise<FollowUpSuggestionResult> {
  const provider = createFollowUpGenerationProvider();

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
      message: "An unexpected error occurred during follow-up generation.",
      retryable: false,
    },
  };
}
