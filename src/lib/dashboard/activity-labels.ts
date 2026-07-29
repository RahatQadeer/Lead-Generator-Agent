import type { ActivityType } from "@/types/dashboard";

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  search_created: "Search",
  lead_discovered: "Discovery",
  lead_enriched: "Enrichment",
  lead_scored: "Scoring",
};

export function getActivityTypeLabel(type: ActivityType): string {
  return ACTIVITY_TYPE_LABELS[type];
}
