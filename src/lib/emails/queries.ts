import { toOutreachEmailInsert, toSavedEmail } from "@/lib/emails/mapper";
import type { ContactWithCompany } from "@/lib/contacts/mapper";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedEmail, SavedEmail } from "@/types/email-generation";
import type { Database } from "@/types/database";

type OutreachEmailRow = Database["public"]["Tables"]["outreach_emails"]["Row"];

type OutreachEmailWithContact = OutreachEmailRow & {
  contacts: { full_name: string; title: string } | null;
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

export async function getOutreachEmailsByUserId(
  userId: string
): Promise<SavedEmail[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outreach_emails")
    .select("*, contacts(full_name, title)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as OutreachEmailWithContact[]).map((row) => {
    const saved = toSavedEmail(row, row.contacts?.full_name ?? "Unknown");
    if (row.contacts?.title) {
      saved.personalization.leadRole = row.contacts.title;
    }
    return saved;
  });
}
