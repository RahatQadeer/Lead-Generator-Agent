import { createClient } from "@/lib/supabase/server";
import type { ActivityItem, ActivityType } from "@/types/dashboard";

const PER_SOURCE_LIMIT = 8;
const DEFAULT_FEED_LIMIT = 20;

type EmailActivityRow = {
  id: string;
  subject: string;
  created_at?: string;
  sent_at?: string | null;
  replied_at?: string | null;
  contacts: { full_name: string } | null;
};

type FollowUpActivityRow = {
  id: string;
  status: string;
  cancel_reason: string | null;
  scheduled_at: string;
  suggested_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  contacts: { full_name: string } | null;
};

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

  const [
    searches,
    discovered,
    enriched,
    scored,
    drafts,
    sent,
    replied,
    campaigns,
    followUps,
  ] = await Promise.all([
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
    supabase
      .from("outreach_emails")
      .select("id, subject, created_at, contacts(full_name)")
      .eq("user_id", userId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from("outreach_emails")
      .select("id, subject, sent_at, contacts(full_name)")
      .eq("user_id", userId)
      .eq("status", "sent")
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from("outreach_emails")
      .select("id, subject, replied_at, contacts(full_name)")
      .eq("user_id", userId)
      .eq("reply_status", "replied")
      .not("replied_at", "is", null)
      .order("replied_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from("outreach_campaigns")
      .select("id, name, sent_count, total_count, status, completed_at, started_at")
      .eq("user_id", userId)
      .in("status", ["completed", "partial", "failed"])
      .order("completed_at", { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    supabase
      .from("follow_ups")
      .select(
        "id, status, cancel_reason, scheduled_at, suggested_at, cancelled_at, created_at, contacts(full_name)"
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
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

  for (const row of (drafts.data ?? []) as EmailActivityRow[]) {
    const contact = row.contacts;
    pushActivity(items, {
      id: `draft-${row.id}`,
      type: "email_generated",
      title: "Email draft created",
      description: `${contact?.full_name ?? "Lead"} · ${row.subject}`,
      timestamp: row.created_at as string,
      href: "/emails",
    });
  }

  for (const row of (sent.data ?? []) as EmailActivityRow[]) {
    const contact = row.contacts;
    pushActivity(items, {
      id: `sent-${row.id}`,
      type: "email_sent",
      title: "Email sent",
      description: `${contact?.full_name ?? "Lead"} · ${row.subject}`,
      timestamp: row.sent_at as string,
      href: "/emails",
    });
  }

  for (const row of (replied.data ?? []) as EmailActivityRow[]) {
    const contact = row.contacts;
    pushActivity(items, {
      id: `replied-${row.id}`,
      type: "email_replied",
      title: "Reply received",
      description: `${contact?.full_name ?? "Lead"} · ${row.subject}`,
      timestamp: row.replied_at as string,
      href: "/emails",
    });
  }

  for (const row of campaigns.data ?? []) {
    const timestamp = row.completed_at ?? row.started_at;
    pushActivity(items, {
      id: `campaign-${row.id}`,
      type: "campaign_completed",
      title: "Campaign finished",
      description: `${row.name} · ${row.sent_count}/${row.total_count} sent`,
      timestamp,
      href: "/emails",
    });
  }

  for (const row of (followUps.data ?? []) as FollowUpActivityRow[]) {
    const contact = row.contacts;
    const name = contact?.full_name ?? "Lead";

    if (row.suggested_at) {
      pushActivity(items, {
        id: `follow-up-suggestion-${row.id}`,
        type: "follow_up_suggested",
        title: "Follow-up suggested",
        description: name,
        timestamp: row.suggested_at,
        href: "/emails",
      });
    }

    if (row.status === "cancelled" && row.cancelled_at) {
      pushActivity(items, {
        id: `follow-up-cancelled-${row.id}`,
        type: "follow_up_cancelled",
        title:
          row.cancel_reason === "replied"
            ? "Follow-up cancelled (replied)"
            : "Follow-up cancelled",
        description: name,
        timestamp: row.cancelled_at,
        href: "/emails",
      });
    } else if (row.status === "scheduled") {
      pushActivity(items, {
        id: `follow-up-scheduled-${row.id}`,
        type: "follow_up_scheduled",
        title: "Follow-up scheduled",
        description: `${name} · due ${new Date(row.scheduled_at).toLocaleDateString()}`,
        timestamp: row.created_at,
        href: "/emails",
      });
    }
  }

  return sortAndLimit(items, limit);
}

export { getActivityTypeLabel } from "@/lib/dashboard/activity-labels";
