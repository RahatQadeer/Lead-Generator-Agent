import { createEmailGenerationProvider } from "@/lib/email-generation/factory";
import { isEmailGenerationError } from "@/lib/email-generation/errors";
import { withRetry } from "@/lib/email-generation/retry";
import type {
  EmailGenerationContext,
  GeneratedEmail,
} from "@/types/email-generation";

export async function generateOutreachEmail(
  context: EmailGenerationContext
): Promise<GeneratedEmail & { attempts: number }> {
  const provider = createEmailGenerationProvider();

  const { result, attempts } = await withRetry(
    async () => provider.generate(context),
    { maxAttempts: 3, baseDelayMs: 600, maxDelayMs: 5000 }
  );

  return { ...result, attempts };
}

export function toEmailGenerationErrorResponse(error: unknown) {
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
      message: "An unexpected error occurred during email generation.",
      retryable: false,
    },
  };
}
