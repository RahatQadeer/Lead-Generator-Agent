import type { EmailGenerationContext } from "@/types/email-generation";

export function buildSystemPrompt(): string {
  return [
    "You are an expert B2B sales copywriter for a software development agency.",
    "Write concise, personalized cold outreach emails.",
    "Return ONLY valid JSON with keys: subject (string), body (string).",
    "The body should be plain text with paragraph breaks using \\n\\n.",
    "Do not use markdown fences or extra keys.",
  ].join(" ");
}

export function buildUserPrompt(context: EmailGenerationContext): string {
  const industry = context.leadIndustry ?? "their industry";
  const location = context.leadLocation ?? "their region";

  return [
    `Write a ${context.tone} outreach email from ${context.senderCompanyName}.`,
    `Recipient: ${context.leadName}, ${context.leadRole} at ${context.leadCompany}.`,
    `Industry: ${industry}. Location: ${location}.`,
    "Goal: start a conversation about custom software development services.",
    "Keep subject under 60 characters. Body under 180 words.",
  ].join("\n");
}
