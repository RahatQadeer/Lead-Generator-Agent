import { SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchBuilderPanel } from "@/components/search-builder/SearchBuilderPanel";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

/**
 * The provider-pipeline search builder.
 *
 * Deliberately a NEW route rather than a replacement for `/searches`: the legacy
 * builder stays reachable until this one is verified against a migrated
 * database, so there is never a window with no working way to create a search.
 *
 * Reads raw rows rather than going through `getUserSearches()`, whose mapper
 * predates migration 035 and drops the new filter columns.
 */
export default async function SearchBuilderPage() {
  const { user } = await getAuthContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("searches")
    .select("id, name, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <>
      <PageHeader
        icon={SlidersHorizontal}
        title="Search builder"
        description="Define who you're looking for, then run the lead generation pipeline."
      />
      <SearchBuilderPanel initialSearches={data ?? []} />
    </>
  );
}
