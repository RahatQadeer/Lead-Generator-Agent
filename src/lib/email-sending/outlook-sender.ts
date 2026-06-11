import { EmailSendingError } from "@/lib/email-sending/errors";
import { getValidOutlookAccessToken } from "@/lib/outlook/token";
import type { SendOutreachInput, SendOutreachResult } from "@/types/email-sending";

interface GraphErrorBody {
  error?: {
    message?: string;
    code?: string;
  };
}

export async function sendViaOutlook(
  userId: string,
  input: SendOutreachInput
): Promise<SendOutreachResult> {
  const accessToken = await getValidOutlookAccessToken(userId);

  let response: Response;
  try {
    response = await fetch(
      "https://graph.microsoft.com/v1.0/me/sendMail",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: input.subject,
            body: {
              contentType: "Text",
              content: input.body,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: input.to,
                },
              },
            ],
          },
          saveToSentItems: true,
        }),
      }
    );
  } catch (error) {
    throw new EmailSendingError(
      "NETWORK_ERROR",
      "Failed to reach Microsoft Graph API.",
      { statusCode: 502, retryable: true, cause: error }
    );
  }

  if (!response.ok) {
    let message = `Microsoft Graph returned status ${response.status}`;
    try {
      const body = (await response.json()) as GraphErrorBody;
      if (body.error?.message) message = body.error.message;
    } catch {
      // ignore parse errors
    }

    throw new EmailSendingError("SEND_FAILED", message, {
      statusCode: response.status,
      retryable: response.status >= 500,
    });
  }

  const requestId = response.headers.get("request-id");

  return {
    provider: "outlook",
    messageId: requestId ?? `outlook-${Date.now()}`,
    sentAt: new Date().toISOString(),
  };
}
