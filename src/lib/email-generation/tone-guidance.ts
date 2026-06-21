import type { EmailTone } from "@/types/email-generation";

const TONE_GUIDANCE: Record<EmailTone, string> = {
  professional:
    "Polished and businesslike. Warm but reserved. Use clear, confident language without being stiff.",
  friendly:
    "Conversational and approachable. Sound like a helpful peer, not a sales script. Light warmth is fine.",
  formal:
    "Traditional business correspondence. No contractions. Respectful and structured tone throughout.",
  direct:
    "Brief and to the point. Lead with value, minimize filler, and make the ask obvious in few words.",
};

export function getToneGuidance(tone: EmailTone): string {
  return TONE_GUIDANCE[tone];
}

export function getToneLabel(tone: EmailTone): string {
  return tone.charAt(0).toUpperCase() + tone.slice(1);
}
