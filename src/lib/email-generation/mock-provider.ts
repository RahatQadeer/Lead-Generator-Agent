import type { EmailGenerationProvider } from "@/lib/email-generation/types";
import type {
  EmailGenerationContext,
  GeneratedEmail,
} from "@/types/email-generation";

function pickPainPoint(context: EmailGenerationContext): string {
  return (
    context.painPoints[0] ??
    `keeping pace with change in ${context.industry ?? "your industry"}`
  );
}

export class MockEmailGenerationProvider implements EmailGenerationProvider {
  readonly name = "mock";
  readonly model = "mock-template-v2";

  async generate(context: EmailGenerationContext): Promise<GeneratedEmail> {
    await new Promise((r) => setTimeout(r, 400));

    const firstName = context.leadName.split(" ")[0];
    const industry = context.industry ?? "your industry";
    const painPoint = pickPainPoint(context);
    const subject = `${context.leadCompany} + faster product delivery`;

    const body = [
      `Hi ${firstName},`,
      "",
      `I came across ${context.leadCompany} and was impressed by what your team is building in ${industry}.`,
      "",
      `Many ${context.leadRole}s I speak with are focused on ${painPoint.toLowerCase()}. That is exactly where ${context.senderCompanyName} helps — we partner with companies like yours to ship reliable software faster, from discovery through launch.`,
      "",
      `Would you be open to a brief call next week to see if we could support your roadmap?`,
      "",
      "Best regards,",
      context.senderCompanyName,
    ].join("\n");

    return {
      subject,
      body,
      provider: this.name,
      model: this.model,
      generatedAt: new Date().toISOString(),
      personalization: {
        leadName: context.leadName,
        leadRole: context.leadRole,
        leadCompany: context.leadCompany,
        industry: context.industry,
        painPoints: context.painPoints,
      },
    };
  }
}
