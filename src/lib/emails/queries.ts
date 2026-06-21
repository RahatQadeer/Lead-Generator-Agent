import { getPausedContactIds } from "@/lib/follow-ups/queries";
import { toOutreachEmailInsert, toSavedEmail } from "@/lib/emails/mapper";
import type { ContactWithCompany } from "@/lib/contacts/mapper";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedEmail, SavedEmail } from "@/types/email-generation";
import type { Database } from "@/types/database";

type OutreachEmailRow = Database["public"]["Tables"]["outreach_emails"]["Row"];

type OutreachEmailWithContact = OutreachEmailRow & {
  contacts: { full_name: string; title: string; email: string | null } | null;
};

export async function getSearchKeywordsForContact(
  userId: string,
  searchId: string | null
): Promise<string[]> {
  if (!searchId) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("searches")
    .select("keywords")
    .eq("id", searchId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return [];

  return data.keywords ?? [];
}

export async function getContactById(
  userId: string,
  contactId: string
): Promise<ContactWithCompany | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select(
      "*, companies(name, city, state, country, industry, employee_count, technologies, domain, website_url)"
    )
    .eq("id", contactId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return data as ContactWithCompany;
}

export async function saveGeneratedEmail(
  userId: string,
  contactId: string,
  email: GeneratedEmail
): Promise<SavedEmail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outreach_emails")
    .insert(toOutreachEmailInsert(userId, contactId, email))
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to save outreach email:", error?.message);
    return null;
  }

  const contact = await getContactById(userId, contactId);

  return toSavedEmail(
    data,
    contact?.full_name ?? email.personalization.leadName
  );
}

function mapOutreachEmailRow(row: OutreachEmailWithContact): SavedEmail {
  const saved = toSavedEmail(row, row.contacts?.full_name ?? "Unknown");
  if (row.contacts?.title) {
    saved.personalization.leadRole = row.contacts.title;
  }
  if (!saved.recipientEmail && row.contacts?.email) {
    saved.recipientEmail = row.contacts.email;
  }
  return saved;
}

export async function getOutreachEmailById(
  userId: string,
  emailId: string
): Promise<SavedEmail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outreach_emails")
    .select("*, contacts(full_name, title, email)")
    .eq("id", emailId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return mapOutreachEmailRow(data as OutreachEmailWithContact);
}

export async function getOutreachEmailsByUserId(
  userId: string
): Promise<SavedEmail[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outreach_emails")
    .select("*, contacts(full_name, title, email)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as OutreachEmailWithContact[]).map(mapOutreachEmailRow);
}

export async function getDraftOutreachEmails(
  userId: string,
  emailIds?: string[]
): Promise<SavedEmail[]> {
  const supabase = await createClient();

  let query = supabase
    .from("outreach_emails")
    .select("*, contacts(full_name, title, email)")
    .eq("user_id", userId)
    .eq("status", "draft")
    .order("created_at", { ascending: true });

  if (emailIds && emailIds.length > 0) {
    query = query.in("id", emailIds);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  const pausedContactIds = await getPausedContactIds(userId);

  return (data as OutreachEmailWithContact[])
    .filter((row) => !pausedContactIds.has(row.contact_id))
    .map(mapOutreachEmailRow);
}

export async function markOutreachEmailSent(
  userId: string,
  emailId: string,
  input: {
    recipientEmail: string;
    gmailMessageId: string;
    sentAt: string;
    campaignId?: string;
  }
): Promise<SavedEmail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outreach_emails")
    .update({
      status: "sent",
      recipient_email: input.recipientEmail,
      gmail_message_id: input.gmailMessageId,
      sent_at: input.sentAt,
      campaign_id: input.campaignId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", emailId)
    .eq("user_id", userId)
    .select("*, contacts(full_name, title, email)")
    .single();

  if (error || !data) return null;

  return mapOutreachEmailRow(data as OutreachEmailWithContact);
}

export async function getSentEmailCount(userId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("outreach_emails")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "sent");

  if (error || count === null) return 0;

  return count;
}
