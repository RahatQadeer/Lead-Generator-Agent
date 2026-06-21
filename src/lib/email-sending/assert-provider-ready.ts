import { EmailSendingError } from "@/lib/email-sending/errors";
import { getGmailConnection } from "@/lib/gmail/connection";
import { getOutlookConnection } from "@/lib/outlook/connection";
import type { EmailSendingProviderName } from "@/types/email-sending";

export async function assertSendingProviderReady(
  userId: string,
  provider: EmailSendingProviderName
): Promise<void> {
  if (provider === "gmail") {
    const connection = await getGmailConnection(userId);
    if (!connection?.refresh_token) {
      throw new EmailSendingError(
        "GMAIL_NOT_CONNECTED",
        "Gmail is not connected. Sign in again with Google from Settings to grant send access.",
        { statusCode: 400, retryable: false }
      );
    }
    return;
  }

  if (provider === "outlook") {
    const connection = await getOutlookConnection(userId);
    if (!connection?.refresh_token) {
      throw new EmailSendingError(
        "OUTLOOK_NOT_CONNECTED",
        "Outlook is not connected. Connect your Microsoft account from Settings.",
        { statusCode: 400, retryable: false }
      );
    }
  }
}
