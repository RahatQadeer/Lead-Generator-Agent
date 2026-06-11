import type { Database } from "@/types/database";
import type { EmailTone, GeneratedEmail, SavedEmail } from "@/types/email-generation";
import { parseEmailTone } from "@/lib/email-generation/parse-tone";

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
    lead_company: email.personalization.leadCompany,
    industry: email.personalization.industry,
    pain_points: email.personalization.painPoints,
    tone: email.personalization.tone,
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
    subject: row.subject,
    body: row.body,
    provider: row.provider,
    model: row.model,
    status: row.status as SavedEmail["status"],
    generatedAt: row.created_at,
    createdAt: row.created_at,
    personalization: {
      leadName,
      leadRole: "",
      leadCompany: row.lead_company ?? "Unknown",
      industry: row.industry,
      painPoints: row.pain_points ?? [],
      tone: parseEmailTone(row.tone),
    },
  };
}
