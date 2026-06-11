import type { Database } from "@/types/database";
import type { GeneratedEmail, SavedEmail } from "@/types/email-generation";

type OutreachEmailRow = Database["public"]["Tables"]["outreach_emails"]["Row"];
type OutreachEmailInsert = Database["public"]["Tables"]["outreach_emails"]["Insert"];

export function toOutreachEmailInsert(
  userId: string,
  contactId: string,
  email: GeneratedEmail
): OutreachEmailInsert {
  return {
    user_id: userId,
    contact_id: contactId,
    subject: email.subject,
    body: email.body,
    provider: email.provider,
    model: email.model,
    status: "draft",
    updated_at: new Date().toISOString(),
  };
}

export function toSavedEmail(
  row: OutreachEmailRow,
  leadName: string
): SavedEmail {
  return {
    id: row.id,
    contactId: row.contact_id,
    leadName,
    subject: row.subject,
    body: row.body,
    provider: row.provider,
    model: row.model,
    status: row.status as SavedEmail["status"],
    generatedAt: row.created_at,
    createdAt: row.created_at,
  };
}
