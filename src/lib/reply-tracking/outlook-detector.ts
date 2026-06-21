import { ReplyTrackingError } from "@/lib/reply-tracking/errors";
import type { ReplyDetector } from "@/lib/reply-tracking/types";
import { getOutlookConnection } from "@/lib/outlook/connection";
import { getValidOutlookAccessToken } from "@/lib/outlook/token";
import type {
  DetectedReply,
  SentEmailForReplyCheck,
} from "@/types/reply-tracking";

interface GraphMessage {
  id: string;
  receivedDateTime?: string;
  bodyPreview?: string;
  subject?: string;
  from?: {
    emailAddress?: {
      address?: string;
    };
  };
}

interface GraphMessageList {
  value?: GraphMessage[];
}

export class OutlookReplyDetector implements ReplyDetector {
  readonly name = "outlook";

  async detectReplies(
    userId: string,
    emails: SentEmailForReplyCheck[]
  ): Promise<DetectedReply[]> {
    const connection = await getOutlookConnection(userId);
    if (!connection?.refresh_token) {
      throw new ReplyTrackingError(
        "PROVIDER_NOT_CONNECTED",
        "Outlook is not connected. Connect from Settings to detect replies.",
        { statusCode: 400, retryable: false }
      );
    }

    const accessToken = await getValidOutlookAccessToken(userId);
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
    const sentDate = new Date(email.sentAt).toISOString();
    const filter = encodeURIComponent(
      `receivedDateTime ge ${sentDate} and from/emailAddress/address eq '${email.recipientEmail}'`
    );

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$filter=${filter}&$top=5&$select=id,receivedDateTime,bodyPreview,subject,from`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      if (response.status === 403) {
        throw new ReplyTrackingError(
          "DETECTION_FAILED",
          "Outlook read access is required. Reconnect with Mail.Read permission.",
          { statusCode: 403, retryable: false }
        );
      }
      return null;
    }

    const body = (await response.json()) as GraphMessageList;
    const message = body.value?.[0];
    if (!message) return null;

    const subject = message.subject ?? "";
    if (
      !subject.toLowerCase().startsWith("re:") &&
      !subject.toLowerCase().includes(email.subject.toLowerCase().slice(0, 20))
    ) {
      return null;
    }

    return {
      emailId: email.id,
      repliedAt: message.receivedDateTime ?? new Date().toISOString(),
      snippet: message.bodyPreview ?? "Reply received",
      providerMessageId: message.id,
    };
  }
}
