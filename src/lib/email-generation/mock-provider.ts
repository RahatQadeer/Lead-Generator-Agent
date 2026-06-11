import type { EmailGenerationProvider } from "@/lib/email-generation/types";
import type {
  EmailGenerationContext,
  GeneratedEmail,
} from "@/types/email-generation";

export class MockEmailGenerationProvider implements EmailGenerationProvider {
  readonly name = "mock";
  readonly model = "mock-template-v1";

  async generate(context: EmailGenerationContext): Promise<GeneratedEmail> {
    await new Promise((r) => setTimeout(r, 400));

    const subject = `Partnership idea for ${context.leadCompany}`;
    const body = [
      `Hi ${context.leadName.split(" ")[0]},`,
      "",
      `I noticed ${context.leadCompany} is growing in ${context.leadIndustry ?? "your space"}, and I wanted to reach out personally.`,
      "",
      `I'm reaching out from ${context.senderCompanyName}. We help companies like yours ship reliable software faster — from product discovery through launch.`,
      "",
      `Would you be open to a brief call next week to explore whether we could support your team?`,
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
    };
  }
}
