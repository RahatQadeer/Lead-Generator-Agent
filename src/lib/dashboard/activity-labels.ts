import type { ActivityType } from "@/types/dashboard";

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  search_created: "Search",
  lead_discovered: "Discovery",
  lead_enriched: "Enrichment",
  lead_scored: "Scoring",
  email_generated: "Draft",
  email_sent: "Sent",
  email_replied: "Reply",
  campaign_completed: "Campaign",
  follow_up_scheduled: "Follow-up",
  follow_up_cancelled: "Follow-up",
  follow_up_suggested: "Follow-up",
};

export function getActivityTypeLabel(type: ActivityType): string {
  return ACTIVITY_TYPE_LABELS[type];
}
