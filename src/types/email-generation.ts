export const EMAIL_TONES = [
  "professional",
  "friendly",
  "formal",
  "direct",
] as const;

export type EmailTone = (typeof EMAIL_TONES)[number];

export interface EmailPersonalization {
  leadName: string;
  leadRole: string;
  leadCompany: string;
  industry: string | null;
  painPoints: string[];
  tone: EmailTone;
}

export interface EmailGenerationContext extends EmailPersonalization {
  leadLocation: string | null;
  senderCompanyName: string;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  provider: string;
  model: string | null;
  generatedAt: string;
  personalization: EmailPersonalization;
}

export interface SavedEmail extends GeneratedEmail {
  id: string;
  contactId: string;
  status: EmailDraftStatus;
  createdAt: string;
  recipientEmail: string | null;
  sentAt: string | null;
  gmailMessageId: string | null;
}

export interface EmailGenerationPreview {
  contactId: string;
  leadName: string;
  leadRole: string;
  leadCompany: string;
  industry: string | null;
  painPoints: string[];
  defaultTone: EmailTone;
}

export type EmailDraftStatus = "draft" | "sent" | "archived";
