export function parseEmailJson(content: string): { subject: string; body: string } {
  const trimmed = content.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenced ? fenced[1].trim() : trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("OpenAI returned invalid JSON for email content.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("subject" in parsed) ||
    !("body" in parsed) ||
    typeof (parsed as { subject: unknown }).subject !== "string" ||
    typeof (parsed as { body: unknown }).body !== "string"
  ) {
    throw new Error("OpenAI response missing subject or body fields.");
  }

  const subject = (parsed as { subject: string }).subject.trim();
  const body = (parsed as { body: string }).body.trim();

  if (!subject || !body) {
    throw new Error("OpenAI returned empty subject or body.");
  }

  return { subject, body };
}
