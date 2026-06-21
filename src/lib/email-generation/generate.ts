import { createEmailGenerationProviderFromConfig } from "@/lib/email-generation/factory";
import { isEmailGenerationError } from "@/lib/email-generation/errors";
import { resolveEmailGenerationConfig } from "@/lib/openai/settings";
import { withRetry } from "@/lib/email-generation/retry";
import type {
  EmailGenerationContext,
  GeneratedEmail,
} from "@/types/email-generation";

export async function generateOutreachEmail(
  userId: string,
  context: EmailGenerationContext
): Promise<GeneratedEmail & { attempts: number }> {
  const config = await resolveEmailGenerationConfig(userId);
  const provider = createEmailGenerationProviderFromConfig(config);

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
      message: "Something went wrong while writing the email. Please try again.",
      retryable: false,
    },
  };
}
