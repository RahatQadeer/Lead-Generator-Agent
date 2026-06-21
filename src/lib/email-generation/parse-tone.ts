import type { EmailTone } from "@/types/email-generation";
import { EMAIL_TONES } from "@/types/email-generation";

export function parseEmailTone(value: unknown): EmailTone {
  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim() as EmailTone;
    if (EMAIL_TONES.includes(normalized)) {
      return normalized;
    }
  }

  return "professional";
}
