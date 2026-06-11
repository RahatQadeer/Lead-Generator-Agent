import { EmailSendingError, isEmailSendingError } from "@/lib/email-sending/errors";
import { resolveSendingProvider } from "@/lib/email-sending/resolve-provider";
import { sendViaGmail } from "@/lib/email-sending/gmail-sender";
import { sendViaMock } from "@/lib/email-sending/mock-sender";
import { sendViaOutlook } from "@/lib/email-sending/outlook-sender";
import type { SendOutreachInput, SendOutreachResult } from "@/types/email-sending";

export async function sendOutreachEmail(
  userId: string,
  input: SendOutreachInput
): Promise<SendOutreachResult> {
  const provider = await resolveSendingProvider(userId);

  if (provider === "gmail") {
    return sendViaGmail(userId, input);
  }

  if (provider === "outlook") {
    return sendViaOutlook(userId, input);
  }

  return sendViaMock(input);
}

export function toEmailSendingErrorResponse(error: unknown) {
  if (isEmailSendingError(error)) {
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
      code: "SEND_FAILED" as const,
      message: "An unexpected error occurred while sending the email.",
      retryable: false,
    },
  };
}

export function assertRecipientEmail(email: string | null | undefined): string {
  if (!email?.trim()) {
    throw new EmailSendingError(
      "NO_RECIPIENT",
      "Contact has no email address to send to.",
      { statusCode: 400, retryable: false }
    );
  }

  return email.trim();
}
