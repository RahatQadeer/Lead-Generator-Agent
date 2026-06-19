import { createClient } from "@/lib/supabase/server";
import type { SearchPipelineProgress } from "@/types/search-pipeline";

function isEmailLead(row: {
  enriched_at: string | null;
  outreach_channel: string | null;
  email: string | null;
}): boolean {
  if (!row.enriched_at) return false;
  return (
    row.outreach_channel === "email" ||
    (!row.outreach_channel && Boolean(row.email))
  );
}

export async function getSearchPipelineProgress(
  userId: string,
  searchId: string
): Promise<SearchPipelineProgress> {
  const supabase = await createClient();

  const [companiesResult, contactsResult] = await Promise.all([
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("search_id", searchId),
    supabase
      .from("contacts")
      .select(
        "enriched_at, email_verified_at, lead_scored_at, outreach_channel, email"
      )
      .eq("user_id", userId)
      .eq("search_id", searchId)
      .is("discarded_at", null),
  ]);

  const rows = contactsResult.data ?? [];
  const enrichedRows = rows.filter((row) => row.enriched_at);
  const emailLeadCount = enrichedRows.filter(isEmailLead).length;

  return {
    companyCount: companiesResult.count ?? 0,
    contactCount: rows.length,
    enrichedCount: enrichedRows.length,
    verifiedCount: rows.filter((row) => row.email_verified_at).length,
    scoredCount: rows.filter((row) => row.lead_scored_at).length,
    emailLeadCount,
  };
}
