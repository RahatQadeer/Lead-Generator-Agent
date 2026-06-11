export type EmailSendingProviderName = "mock" | "gmail" | "outlook";

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

export interface EmailProviderConnectionStatus {
  connected: boolean;
  accountAddress: string | null;
  provider: EmailSendingProviderName;
}

/** @deprecated Use EmailProviderConnectionStatus */
export type GmailConnectionStatus = EmailProviderConnectionStatus;
