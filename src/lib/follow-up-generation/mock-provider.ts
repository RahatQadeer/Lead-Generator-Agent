import type { FollowUpGenerationProvider } from "@/lib/follow-up-generation/types";
import type { EmailTone } from "@/types/email-generation";
import type {
  FollowUpGenerationContext,
  GeneratedFollowUpSuggestion,
} from "@/types/follow-up-suggestion";

const templates: Record<
  EmailTone,
  { subject: (ctx: FollowUpGenerationContext) => string; lines: string[] }
> = {
  professional: {
    subject: (ctx) => `Following up — ${ctx.leadCompany}`,
    lines: [
      "I wanted to follow up on my note from last week.",
      "I know priorities shift quickly, so I will keep this brief.",
      "If exploring a partnership on software delivery is still on your radar, I would welcome a short call at your convenience.",
    ],
  },
  friendly: {
    subject: (ctx) => `Quick bump — ${ctx.leadCompany}`,
    lines: [
      "Just circling back on my message from a few days ago.",
      "No pressure at all — wanted to see if a quick chat might still be useful.",
      "Happy to work around your schedule if you are open to it.",
    ],
  },
  formal: {
    subject: (ctx) => `Re: ${ctx.originalSubject}`,
    lines: [
      "I am writing to follow up regarding my previous correspondence.",
      "Should your team still be evaluating software development partners, I would appreciate the opportunity to discuss how we might assist.",
      "Please let me know a suitable time for a brief conversation.",
    ],
  },
  direct: {
    subject: (ctx) => `${ctx.leadCompany} — still interested?`,
    lines: [
      "Following up on my last email.",
      "Still open to a 15-minute call this week?",
      "If timing is off, just let me know and I will check back later.",
    ],
  },
};

export class MockFollowUpGenerationProvider implements FollowUpGenerationProvider {
  readonly name = "mock";
  readonly model = "mock-follow-up-v1";

  async generate(
    context: FollowUpGenerationContext
  ): Promise<GeneratedFollowUpSuggestion> {
    await new Promise((r) => setTimeout(r, 350));

    const firstName = context.leadName.split(" ")[0];
    const template = templates[context.tone];
    const sender = context.senderCompanyName;

    const body = [
      context.tone === "formal" ? `Dear ${firstName},` : `Hi ${firstName},`,
      "",
      ...template.lines,
      "",
      context.tone === "formal" ? "Kind regards," : "Best,",
      sender,
    ].join("\n");

    return {
      subject: template.subject(context),
      body,
      provider: this.name,
      model: this.model,
      generatedAt: new Date().toISOString(),
    };
  }
}
