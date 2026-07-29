import { createClient } from "@/lib/supabase/server";
import type { ActivityItem, ActivityType } from "@/types/dashboard";

const PER_SOURCE_LIMIT = 8;
const DEFAULT_FEED_LIMIT = 20;

function pushActivity(
  items: ActivityItem[],
  input: Omit<ActivityItem, "id"> & { id: string }
): void {
  items.push(input);
}

function sortAndLimit(items: ActivityItem[], limit: number): ActivityItem[] {
  return items
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, limit);
}

export async function getRecentActivity(
  userId: string,
  limit = DEFAULT_FEED_LIMIT
): Promise<ActivityItem[]> {
  const supabase = await createClient();
  const items: ActivityItem[] = [];

  const [searches, discovered, enriched, scored] = await Promise.all([
    supabase
      .from("searches")
      .select("id, name, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from("contacts")
      .select("id, full_name, company_name, first_discovered_at")
      .eq("user_id", userId)
      .order("first_discovered_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from("contacts")
      .select("id, full_name, company_name, enriched_at")
      .eq("user_id", userId)
      .not("enriched_at", "is", null)
      .order("enriched_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from("contacts")
      .select("id, full_name, lead_score, lead_scored_at")
      .eq("user_id", userId)
      .not("lead_scored_at", "is", null)
      .order("lead_scored_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT),
  ]);

  for (const row of searches.data ?? []) {
    pushActivity(items, {
      id: `search-${row.id}`,
      type: "search_created",
      title: "Search created",
      description: row.name,
      timestamp: row.created_at,
      href: "/searches",
    });
  }

  for (const row of discovered.data ?? []) {
    pushActivity(items, {
      id: `discovered-${row.id}`,
      type: "lead_discovered",
      title: "Lead discovered",
      description: `${row.full_name}${row.company_name ? ` · ${row.company_name}` : ""}`,
      timestamp: row.first_discovered_at,
      href: "/leads",
    });
  }

  for (const row of enriched.data ?? []) {
    pushActivity(items, {
      id: `enriched-${row.id}`,
      type: "lead_enriched",
      title: "Lead enriched",
      description: `${row.full_name}${row.company_name ? ` · ${row.company_name}` : ""}`,
      timestamp: row.enriched_at as string,
      href: "/leads",
    });
  }

  for (const row of scored.data ?? []) {
    pushActivity(items, {
      id: `scored-${row.id}-${row.lead_scored_at}`,
      type: "lead_scored",
      title: "Lead scored",
      description: `${row.full_name} · Score ${row.lead_score}/10`,
      timestamp: row.lead_scored_at as string,
      href: "/leads",
    });
  }

  return sortAndLimit(items, limit);
}

export { getActivityTypeLabel } from "@/lib/dashboard/activity-labels";
