export type EmailSendingProviderName = "mock" | "gmail";

export interface SendOutreachInput {
  to: string;
  subject: string;
  body: string;
  fromAddress: string;
}

export interface SendOutreachResult {
  provider: EmailSendingProviderName;
  messageId: string;
  sentAt: string;
}

export interface GmailConnectionStatus {
  connected: boolean;
  gmailAddress: string | null;
  provider: EmailSendingProviderName;
}
