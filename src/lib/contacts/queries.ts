import {
  toContactInsert,
  toEmailVerificationInput,
  toEmailVerificationUpdate,
  toEnrichedLead,
  toEnrichedLeadUpdate,
  toLeadEnrichmentInput,
  toLeadScoreUpdate,
  toLeadScoringInput,
  type ContactWithCompany,
} from "@/lib/contacts/mapper";
import { createClient } from "@/lib/supabase/server";
import type { DiscoveredContact } from "@/types/contact";
import type { EmailVerificationInput } from "@/types/email-verification";
import type { VerifiedEmail } from "@/types/email-verification";
import type { EnrichedLead } from "@/types/lead";
import type { ScoredLeadResult } from "@/types/lead-scoring";

export async function getKnownContactDedupKeys(
  userId: string
): Promise<Set<string>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("dedup_key")
    .eq("user_id", userId);

  if (error || !data) return new Set();

  return new Set(data.map((row) => row.dedup_key));
}

export async function upsertDiscoveredContacts(
  userId: string,
  searchId: string,
  provider: string,
  contacts: DiscoveredContact[]
): Promise<void> {
  const rows = contacts
    .map((contact) => toContactInsert(userId, searchId, provider, contact))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return;

  const supabase = await createClient();

  const { error } = await supabase.from("contacts").upsert(rows, {
    onConflict: "user_id,dedup_key",
  });

  if (error) {
    console.error("Failed to persist discovered contacts:", error.message);
  }
}

export async function getContactsBySearchId(
  userId: string,
  searchId: string
): Promise<ContactWithCompany[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select(
      "*, companies(name, city, state, country, industry, employee_count, technologies, domain, website_url)"
    )
    .eq("user_id", userId)
    .eq("search_id", searchId)
    .order("full_name", { ascending: true });

  if (error || !data) return [];

  return data as ContactWithCompany[];
}

export async function saveEnrichedLeads(
  userId: string,
  provider: string,
  leads: EnrichedLead[]
): Promise<void> {
  const supabase = await createClient();

  for (const lead of leads) {
    const { error } = await supabase
      .from("contacts")
      .update(toEnrichedLeadUpdate(lead, provider))
      .eq("id", lead.id)
      .eq("user_id", userId);

    if (error) {
      console.error(`Failed to enrich contact ${lead.id}:`, error.message);
    }
  }
}

export async function getEnrichedLeadsByUserId(
  userId: string
): Promise<EnrichedLead[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .not("enriched_at", "is", null)
    .order("enriched_at", { ascending: false });

  if (error || !data) return [];

  return data
    .map(toEnrichedLead)
    .filter((lead): lead is EnrichedLead => lead !== null);
}

export function toLeadEnrichmentInputs(
  contacts: ContactWithCompany[]
): ReturnType<typeof toLeadEnrichmentInput>[] {
  return contacts.map(toLeadEnrichmentInput);
}

export function toEmailVerificationInputs(
  contacts: ContactWithCompany[]
): EmailVerificationInput[] {
  return contacts.map(toEmailVerificationInput);
}

export function toLeadScoringInputs(
  contacts: ContactWithCompany[]
): ReturnType<typeof toLeadScoringInput>[] {
  return contacts.map(toLeadScoringInput);
}

export async function saveLeadScores(
  userId: string,
  results: ScoredLeadResult[]
): Promise<void> {
  const supabase = await createClient();

  for (const result of results) {
    const { error } = await supabase
      .from("contacts")
      .update(toLeadScoreUpdate(result))
      .eq("id", result.contactId)
      .eq("user_id", userId);

    if (error) {
      console.error(
        `Failed to save lead score for ${result.contactId}:`,
        error.message
      );
    }
  }
}

export async function saveEmailVerificationResults(
  userId: string,
  results: VerifiedEmail[]
): Promise<void> {
  const supabase = await createClient();

  for (const result of results) {
    const { error } = await supabase
      .from("contacts")
      .update(toEmailVerificationUpdate(result))
      .eq("id", result.contactId)
      .eq("user_id", userId);

    if (error) {
      console.error(
        `Failed to save email verification for ${result.contactId}:`,
        error.message
      );
    }
  }
}
