import {
  getDefaultEmailTemplateForTone,
  getEmailTemplateById,
} from "@/lib/email-templates/queries";
import type { EmailGenerationTemplate } from "@/types/email-generation";
import type { EmailTone } from "@/types/email-generation";
import type { EmailTemplate } from "@/types/email-templates";

function toGenerationTemplate(template: EmailTemplate): EmailGenerationTemplate {
  return {
    id: template.id,
    name: template.name,
    subjectTemplate: template.subjectTemplate,
    bodyTemplate: template.bodyTemplate,
  };
}

export async function resolveEmailTemplate(
  userId: string,
  input: { templateId?: string; tone: EmailTone }
): Promise<EmailGenerationTemplate | null> {
  if (input.templateId) {
    const template = await getEmailTemplateById(userId, input.templateId);
    return template ? toGenerationTemplate(template) : null;
  }

  const defaultTemplate = await getDefaultEmailTemplateForTone(userId, input.tone);
  return defaultTemplate ? toGenerationTemplate(defaultTemplate) : null;
}
