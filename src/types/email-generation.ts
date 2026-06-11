export interface EmailGenerationContext {
  leadName: string;
  leadRole: string;
  leadCompany: string;
  leadIndustry: string | null;
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
}

export interface SavedEmail extends GeneratedEmail {
  id: string;
  contactId: string;
  leadName: string;
  status: EmailDraftStatus;
  createdAt: string;
}

export type EmailDraftStatus = "draft" | "sent" | "archived";
