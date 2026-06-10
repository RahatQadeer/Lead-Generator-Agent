import { toContactInsert } from "@/lib/contacts/mapper";
import { createClient } from "@/lib/supabase/server";
import type { DiscoveredContact } from "@/types/contact";

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
