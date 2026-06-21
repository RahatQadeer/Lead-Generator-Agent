import { toCompanyInsert } from "@/lib/companies/mapper";
import { toContactDiscoveryTargetCompany } from "@/lib/contact-discovery/map-criteria";
import { createClient } from "@/lib/supabase/server";
import type { DiscoveredCompany } from "@/types/company";
import type { ContactDiscoveryTargetCompany } from "@/types/contact";

export async function getKnownCompanyDedupKeys(
  userId: string
): Promise<Set<string>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .select("dedup_key")
    .eq("user_id", userId);

  if (error || !data) return new Set();

  return new Set(data.map((row) => row.dedup_key));
}

export async function upsertDiscoveredCompanies(
  userId: string,
  searchId: string,
  provider: string,
  companies: DiscoveredCompany[]
): Promise<void> {
  const rows = companies
    .map((company) => toCompanyInsert(userId, searchId, provider, company))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return;

  const supabase = await createClient();

  const { error } = await supabase.from("companies").upsert(rows, {
    onConflict: "user_id,dedup_key",
  });

  if (error) {
    console.error("Failed to persist discovered companies:", error.message);
  }
}

export async function getCompaniesBySearchId(
  userId: string,
  searchId: string
): Promise<ContactDiscoveryTargetCompany[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", userId)
    .eq("search_id", searchId)
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map(toContactDiscoveryTargetCompany);
}
