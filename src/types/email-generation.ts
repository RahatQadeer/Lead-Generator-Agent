export interface EmailPersonalization {
  leadName: string;
  leadRole: string;
  leadCompany: string;
  industry: string | null;
  painPoints: string[];
}

export interface EmailGenerationContext extends EmailPersonalization {
  leadLocation: string | null;
  senderCompanyName: string;
  tone: "professional" | "friendly";
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
}

export interface EmailGenerationPreview {
  contactId: string;
  leadName: string;
  leadRole: string;
  leadCompany: string;
  industry: string | null;
  painPoints: string[];
}

export type EmailDraftStatus = "draft" | "sent" | "archived";
