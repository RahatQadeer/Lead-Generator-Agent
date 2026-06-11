import { getToneGuidance } from "@/lib/email-generation/tone-guidance";
import type { EmailGenerationContext } from "@/types/email-generation";

export function buildSystemPrompt(): string {
  return [
    "You are an expert B2B sales copywriter for a software development agency.",
    "Write concise, personalized cold outreach emails that reference the recipient's specific pain points.",
    "Match the requested tone precisely — professional, friendly, formal, or direct.",
    "Return ONLY valid JSON with keys: subject (string), body (string).",
    "The body should be plain text with paragraph breaks using \\n\\n.",
    "Do not use markdown fences or extra keys.",
  ].join(" ");
}

export function buildUserPrompt(context: EmailGenerationContext): string {
  const industry = context.industry ?? "their industry";
  const location = context.leadLocation ?? "their region";
  const painPoints = context.painPoints
    .map((point, index) => `${index + 1}. ${point}`)
    .join("\n");

  return [
    `Write a ${context.tone} outreach email from ${context.senderCompanyName}.`,
    `Tone guidance: ${getToneGuidance(context.tone)}`,
    "",
    "Recipient profile:",
    `- Lead: ${context.leadName}, ${context.leadRole}`,
    `- Company: ${context.leadCompany}`,
    `- Industry: ${industry}`,
    `- Location: ${location}`,
    "",
    "Pain points to address (weave at least one naturally into the email):",
    painPoints,
    "",
    "Goal: start a conversation about custom software development services.",
    "Reference the lead by first name, mention their company, and tie your value prop to a relevant pain point.",
    "Keep subject under 60 characters. Body under 180 words.",
  ].join("\n");
}
