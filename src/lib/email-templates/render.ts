import type { EmailGenerationContext } from "@/types/email-generation";

export function buildTemplateVariables(
  context: EmailGenerationContext
): Record<string, string> {
  const firstName = context.leadName.split(" ")[0] || context.leadName;
  const painPoint =
    context.painPoints[0] ??
    `keeping pace with change in ${context.industry ?? "your industry"}`;

  return {
    "{{firstName}}": firstName,
    "{{leadName}}": context.leadName,
    "{{leadRole}}": context.leadRole,
    "{{company}}": context.leadCompany,
    "{{leadCompany}}": context.leadCompany,
    "{{industry}}": context.industry ?? "your industry",
    "{{location}}": context.leadLocation ?? "your region",
    "{{painPoint}}": painPoint,
    "{{sender}}": context.senderCompanyName,
  };
}

export function renderEmailTemplate(
  template: { subjectTemplate: string; bodyTemplate: string },
  context: EmailGenerationContext
): { subject: string; body: string } {
  const variables = buildTemplateVariables(context);

  let subject = template.subjectTemplate;
  let body = template.bodyTemplate;

  for (const [placeholder, value] of Object.entries(variables)) {
    subject = subject.replaceAll(placeholder, value);
    body = body.replaceAll(placeholder, value);
  }

  return { subject, body };
}
