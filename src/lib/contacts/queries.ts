import {
  toContactInsert,
  toEnrichedLead,
  toEnrichedLeadUpdate,
  toLeadEnrichmentInput,
  type ContactWithCompany,
} from "@/lib/contacts/mapper";
import { createClient } from "@/lib/supabase/server";
import type { DiscoveredContact } from "@/types/contact";
import type { EnrichedLead } from "@/types/lead";

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
    .select("*, companies(name, city, state, country)")
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
