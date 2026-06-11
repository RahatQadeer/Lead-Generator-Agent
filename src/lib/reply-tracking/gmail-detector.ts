import { ReplyTrackingError } from "@/lib/reply-tracking/errors";
import type { ReplyDetector } from "@/lib/reply-tracking/types";
import { getGmailConnection } from "@/lib/gmail/connection";
import { getValidGmailAccessToken } from "@/lib/gmail/token";
import type {
  DetectedReply,
  SentEmailForReplyCheck,
} from "@/types/reply-tracking";

interface GmailMessageList {
  messages?: Array<{ id: string; threadId?: string }>;
}

interface GmailMessageMeta {
  internalDate?: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
}

function getHeader(
  message: GmailMessageMeta,
  name: string
): string | undefined {
  return message.payload?.headers?.find(
    (header) => header.name.toLowerCase() === name.toLowerCase()
  )?.value;
}

export class GmailReplyDetector implements ReplyDetector {
  readonly name = "gmail";

  async detectReplies(
    userId: string,
    emails: SentEmailForReplyCheck[]
  ): Promise<DetectedReply[]> {
    const connection = await getGmailConnection(userId);
    if (!connection?.refresh_token) {
      throw new ReplyTrackingError(
        "PROVIDER_NOT_CONNECTED",
        "Gmail is not connected. Reconnect from Settings to detect replies.",
        { statusCode: 400, retryable: false }
      );
    }

    const accessToken = await getValidGmailAccessToken(userId);
    const replies: DetectedReply[] = [];

    for (const email of emails) {
      const reply = await this.findReplyForEmail(accessToken, email);
      if (reply) replies.push(reply);
    }

    return replies;
  }

  private async findReplyForEmail(
    accessToken: string,
    email: SentEmailForReplyCheck
  ): Promise<DetectedReply | null> {
    const sentUnix = Math.floor(new Date(email.sentAt).getTime() / 1000);
    const query = encodeURIComponent(
      `from:${email.recipientEmail} after:${sentUnix}`
    );

    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=5`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listResponse.ok) {
      if (listResponse.status === 403) {
        throw new ReplyTrackingError(
          "DETECTION_FAILED",
          "Gmail read access is required. Reconnect Google with gmail.readonly scope.",
          { statusCode: 403, retryable: false }
        );
      }
      return null;
    }

    const listBody = (await listResponse.json()) as GmailMessageList;
    if (!listBody.messages?.length) return null;

    for (const message of listBody.messages) {
      const metaResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!metaResponse.ok) continue;

      const meta = (await metaResponse.json()) as GmailMessageMeta;
      const subject = getHeader(meta, "Subject") ?? "";
      const from = getHeader(meta, "From") ?? "";

      if (!from.toLowerCase().includes(email.recipientEmail.toLowerCase())) {
        continue;
      }

      if (
        subject.toLowerCase().startsWith("re:") ||
        subject.toLowerCase().includes(email.subject.toLowerCase().slice(0, 20))
      ) {
        return {
          emailId: email.id,
          repliedAt: meta.internalDate
            ? new Date(Number(meta.internalDate)).toISOString()
            : new Date().toISOString(),
          snippet: meta.snippet ?? "Reply received",
          providerMessageId: message.id,
        };
      }
    }

    return null;
  }
}
