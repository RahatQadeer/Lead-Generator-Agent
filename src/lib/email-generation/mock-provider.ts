import type { EmailGenerationProvider } from "@/lib/email-generation/types";
import type {
  EmailGenerationContext,
  EmailTone,
  GeneratedEmail,
} from "@/types/email-generation";

function pickPainPoint(context: EmailGenerationContext): string {
  return (
    context.painPoints[0] ??
    `keeping pace with change in ${context.industry ?? "your industry"}`
  );
}

function buildMockEmail(context: EmailGenerationContext): {
  subject: string;
  body: string;
} {
  const firstName = context.leadName.split(" ")[0];
  const industry = context.industry ?? "your industry";
  const painPoint = pickPainPoint(context).toLowerCase();
  const company = context.leadCompany;
  const sender = context.senderCompanyName;

  const templates: Record<
    EmailTone,
    { subject: string; body: string[]; closing: string }
  > = {
    professional: {
      subject: `Partnership idea for ${company}`,
      body: [
        `Hi ${firstName},`,
        "",
        `I came across ${company} and was impressed by what your team is building in ${industry}.`,
        "",
        `Many ${context.leadRole}s I speak with are focused on ${painPoint}. That is exactly where ${sender} helps — we partner with companies like yours to ship reliable software faster, from discovery through launch.`,
        "",
        `Would you be open to a brief call next week to see if we could support your roadmap?`,
      ],
      closing: "Best regards,",
    },
    friendly: {
      subject: `Quick idea for ${company}`,
      body: [
        `Hey ${firstName},`,
        "",
        `I was checking out ${company} and really liked what you're doing in ${industry}.`,
        "",
        `A lot of ${context.leadRole}s I chat with are trying to tackle ${painPoint}. We've been helping teams like yours move faster on software — without the usual headaches.`,
        "",
        `Open to a quick call next week to see if we could help?`,
      ],
      closing: "Cheers,",
    },
    formal: {
      subject: `Inquiry regarding software partnership — ${company}`,
      body: [
        `Dear ${firstName},`,
        "",
        `I am writing to introduce ${sender} and to express our interest in supporting ${company}'s initiatives within ${industry}.`,
        "",
        `We have observed that organizations in your position frequently encounter challenges related to ${painPoint}. Our firm specializes in delivering dependable software solutions from initial discovery through production launch.`,
        "",
        `I would welcome the opportunity to schedule a brief discussion at your convenience to explore a potential collaboration.`,
      ],
      closing: "Sincerely,",
    },
    direct: {
      subject: `${company} — faster software delivery`,
      body: [
        `${firstName},`,
        "",
        `${company} is growing in ${industry}. You are likely dealing with ${painPoint}.`,
        "",
        `${sender} builds custom software for teams like yours — discovery to launch, no fluff.`,
        "",
        `15-minute call next week?`,
      ],
      closing: "—",
    },
  };

  const template = templates[context.tone];

  return {
    subject: template.subject,
    body: [...template.body, "", template.closing, sender].join("\n"),
  };
}

export class MockEmailGenerationProvider implements EmailGenerationProvider {
  readonly name = "mock";
  readonly model = "mock-template-v3";

  async generate(context: EmailGenerationContext): Promise<GeneratedEmail> {
    await new Promise((r) => setTimeout(r, 400));

    const { subject, body } = buildMockEmail(context);

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
        tone: context.tone,
      },
    };
  }
}
