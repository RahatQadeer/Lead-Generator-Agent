import type { EmailTone } from "@/types/email-generation";

export interface EmailTemplate {
  id: string;
  name: string;
  tone: EmailTone;
  subjectTemplate: string;
  bodyTemplate: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplateInput {
  name: string;
  tone: EmailTone;
  subjectTemplate: string;
  bodyTemplate: string;
  isDefault?: boolean;
}

export interface EmailTemplatePlaceholder {
  key: string;
  description: string;
}

export const EMAIL_TEMPLATE_PLACEHOLDERS: EmailTemplatePlaceholder[] = [
  { key: "{{firstName}}", description: "Lead first name" },
  { key: "{{leadName}}", description: "Lead full name" },
  { key: "{{leadRole}}", description: "Lead job title" },
  { key: "{{company}}", description: "Lead company name" },
  { key: "{{industry}}", description: "Company industry" },
  { key: "{{location}}", description: "Lead or company location" },
  { key: "{{painPoint}}", description: "Primary pain point" },
  { key: "{{sender}}", description: "Your company name" },
];
