import { createClient } from "@/lib/supabase/server";
import { toSearchRecord } from "@/lib/search/mapper";
import type { SearchRecord } from "@/types/search";

export async function getUserSearches(userId: string): Promise<SearchRecord[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("searches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map(toSearchRecord);
}
