import { getToneGuidance } from "@/lib/email-generation/tone-guidance";
import type { FollowUpGenerationContext } from "@/types/follow-up-suggestion";

export function buildFollowUpSystemPrompt(): string {
  return [
    "You are an expert B2B sales copywriter for a software development agency.",
    "Write concise follow-up emails that reference the original outreach without repeating it verbatim.",
    "Follow-ups should be shorter than the initial email — add new value or a gentle bump.",
    "Match the requested tone precisely — professional, friendly, formal, or direct.",
    "Return ONLY valid JSON with keys: subject (string), body (string).",
    "The body should be plain text with paragraph breaks using \\n\\n.",
    "Do not use markdown fences or extra keys.",
  ].join(" ");
}

export function buildFollowUpUserPrompt(
  context: FollowUpGenerationContext
): string {
  const industry = context.industry ?? "their industry";

  return [
    `Write a ${context.tone} follow-up email (sequence #${context.sequenceNumber}) from ${context.senderCompanyName}.`,
    `Tone guidance: ${getToneGuidance(context.tone)}`,
    "",
    "Recipient profile:",
    `- Lead: ${context.leadName}, ${context.leadRole}`,
    `- Company: ${context.leadCompany}`,
    `- Industry: ${industry}`,
    "",
    "Original outreach (sent earlier — do not copy verbatim):",
    `- Subject: ${context.originalSubject}`,
    `- Sent: ${context.originalSentAt} (${context.daysSinceOriginalSend} days ago)`,
    `- Body excerpt: ${context.originalBody.slice(0, 400)}${context.originalBody.length > 400 ? "…" : ""}`,
    "",
    "Goal: re-engage the lead with a brief follow-up that acknowledges no reply yet.",
    "Reference the original topic naturally. Offer an easy next step (quick call, reply, etc.).",
    "Keep subject under 60 characters. Body under 120 words.",
  ].join("\n");
}
