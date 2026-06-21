import type { EmailTone } from "@/types/email-generation";

export interface FollowUpGenerationContext {
  leadName: string;
  leadRole: string;
  leadCompany: string;
  industry: string | null;
  tone: EmailTone;
  senderCompanyName: string;
  originalSubject: string;
  originalBody: string;
  originalSentAt: string;
  sequenceNumber: number;
  daysSinceOriginalSend: number;
}

export interface GeneratedFollowUpSuggestion {
  subject: string;
  body: string;
  provider: string;
  model: string | null;
  generatedAt: string;
}

export interface FollowUpSuggestionResult extends GeneratedFollowUpSuggestion {
  attempts: number;
}
