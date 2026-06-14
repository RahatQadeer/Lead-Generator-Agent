import { encodeOutboundMessage } from "@/lib/email-sending/encode-message";
import { EmailSendingError } from "@/lib/email-sending/errors";
import { getValidGmailAccessToken } from "@/lib/gmail/token";
import type { SendOutreachInput, SendOutreachResult } from "@/types/email-sending";

interface GmailSendResponse {
  id?: string;
  threadId?: string;
  error?: {
    message?: string;
    code?: number;
  };
}

export async function sendViaGmail(
  userId: string,
  input: SendOutreachInput
): Promise<SendOutreachResult> {
  const accessToken = await getValidGmailAccessToken(userId);
  const raw = encodeOutboundMessage(input);

  let response: Response;
  try {
    response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      }
    );
  } catch (error) {
    throw new EmailSendingError(
      "NETWORK_ERROR",
      "Failed to reach Gmail API.",
      { statusCode: 502, retryable: true, cause: error }
    );
  }

  const body = (await response.json()) as GmailSendResponse;

  if (!response.ok || !body.id) {
    throw new EmailSendingError(
      "SEND_FAILED",
      body.error?.message ?? `Gmail API returned status ${response.status}`,
      { statusCode: response.status, retryable: response.status >= 500 }
    );
  }

  return {
    provider: "gmail",
    messageId: body.id,
    threadId: body.threadId,
    sentAt: new Date().toISOString(),
  };
}
