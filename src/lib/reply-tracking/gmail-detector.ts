import { ReplyTrackingError } from "@/lib/reply-tracking/errors";
import {
  buildReplySnippet,
  extractPlainTextFromGmailPayload,
  type GmailMessagePart,
} from "@/lib/reply-tracking/extract-reply-text";
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
  id?: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailMessagePart & {
    headers?: Array<{ name: string; value: string }>;
  };
}

interface GmailThread {
  messages?: GmailMessageMeta[];
}

function getHeader(
  message: GmailMessageMeta,
  name: string
): string | undefined {
  return message.payload?.headers?.find(
    (header) => header.name.toLowerCase() === name.toLowerCase()
  )?.value;
}

function isFromRecipient(from: string, recipientEmail: string): boolean {
  return from.toLowerCase().includes(recipientEmail.toLowerCase());
}

function looksLikeReply(subject: string, originalSubject: string): boolean {
  const normalized = subject.toLowerCase().trim();
  const original = originalSubject.toLowerCase().trim();

  if (normalized.startsWith("re:") || normalized.startsWith("fwd:")) {
    return true;
  }

  if (original.length > 0 && normalized.includes(original.slice(0, 20))) {
    return true;
  }

  return false;
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
    const threadReply = await this.findReplyInThread(accessToken, email);
    if (threadReply) return threadReply;

    return this.findReplyBySearch(accessToken, email);
  }

  private async findReplyInThread(
    accessToken: string,
    email: SentEmailForReplyCheck
  ): Promise<DetectedReply | null> {
    const threadId =
      email.providerThreadId ??
      (email.providerMessageId
        ? await this.getThreadIdForMessage(accessToken, email.providerMessageId)
        : null);

    if (!threadId) return null;

    const threadResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!threadResponse.ok) {
      if (threadResponse.status === 403) {
        throw new ReplyTrackingError(
          "DETECTION_FAILED",
          "Gmail read access is required. Reconnect Google with gmail.readonly scope.",
          { statusCode: 403, retryable: false }
        );
      }
      return null;
    }

    const thread = (await threadResponse.json()) as GmailThread;
    const sentAtMs = new Date(email.sentAt).getTime();

    for (const message of thread.messages ?? []) {
      if (!message.id || message.id === email.providerMessageId) continue;

      const from = getHeader(message, "From") ?? "";
      if (!isFromRecipient(from, email.recipientEmail)) continue;

      const messageAt = message.internalDate
        ? Number(message.internalDate)
        : 0;
      if (messageAt <= sentAtMs) continue;

      return {
        emailId: email.id,
        repliedAt: message.internalDate
          ? new Date(Number(message.internalDate)).toISOString()
          : new Date().toISOString(),
        snippet: await this.getReplySnippet(
          accessToken,
          message.id,
          message.snippet
        ),
        providerMessageId: message.id,
      };
    }

    return null;
  }

  private async getThreadIdForMessage(
    accessToken: string,
    messageId: string
  ): Promise<string | null> {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=minimal`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) return null;

    const body = (await response.json()) as GmailMessageMeta;
    return body.threadId ?? null;
  }

  private async findReplyBySearch(
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
      if (message.id === email.providerMessageId) continue;

      const metaResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!metaResponse.ok) continue;

      const meta = (await metaResponse.json()) as GmailMessageMeta;
      const subject = getHeader(meta, "Subject") ?? "";
      const from = getHeader(meta, "From") ?? "";

      if (!isFromRecipient(from, email.recipientEmail)) continue;

      if (!looksLikeReply(subject, email.subject) && subject.trim().length > 0) {
        continue;
      }

      return {
        emailId: email.id,
        repliedAt: meta.internalDate
          ? new Date(Number(meta.internalDate)).toISOString()
          : new Date().toISOString(),
        snippet: await this.getReplySnippet(
          accessToken,
          message.id,
          meta.snippet
        ),
        providerMessageId: message.id,
      };
    }

    return null;
  }

  private async getReplySnippet(
    accessToken: string,
    messageId: string,
    fallbackSnippet?: string
  ): Promise<string> {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      return buildReplySnippet(null, fallbackSnippet);
    }

    const message = (await response.json()) as GmailMessageMeta;
    const plainBody = extractPlainTextFromGmailPayload(message.payload);

    return buildReplySnippet(plainBody, fallbackSnippet);
  }
}
