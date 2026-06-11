import type { EmailSendingProviderName } from "@/types/email-sending";

export type ReplyStatus = "none" | "replied";

export interface SentEmailForReplyCheck {
  id: string;
  contactId: string;
  leadName: string;
  recipientEmail: string;
  subject: string;
  sentAt: string;
  providerMessageId: string | null;
  providerThreadId: string | null;
}

export interface DetectedReply {
  emailId: string;
  repliedAt: string;
  snippet: string;
  providerMessageId?: string;
}

export interface ReplyDetectionResult {
  provider: EmailSendingProviderName | "mock";
  checkedCount: number;
  repliesFound: number;
  replies: DetectedReply[];
}

export interface ReplySummary {
  sentCount: number;
  repliedCount: number;
  awaitingReplyCount: number;
}
