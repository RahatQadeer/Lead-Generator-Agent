import { toCompanyInsert } from "@/lib/companies/mapper";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DiscoveredCompany } from "@/types/company";

export async function persistDiscoveredCompaniesForUser(
  userId: string,
  searchId: string,
  provider: string,
  companies: DiscoveredCompany[]
): Promise<void> {
  const rows = companies
    .map((company) => toCompanyInsert(userId, searchId, provider, company))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return;

  const supabase = createAdminClient();
  const { error } = await supabase.from("companies").upsert(rows, {
    onConflict: "user_id,dedup_key",
  });

  if (error) {
    throw new Error(`Failed to persist discovered companies: ${error.message}`);
  }
}

export async function detachCompaniesFromSearchAdmin(
  userId: string,
  searchId: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("companies")
    .update({ search_id: null, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("search_id", searchId);

  if (error) {
    throw new Error(`Failed to detach companies from search: ${error.message}`);
  }
}
