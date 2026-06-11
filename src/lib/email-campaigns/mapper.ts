import type { Database } from "@/types/database";
import type { OutreachCampaign } from "@/types/email-campaign";
import type { EmailSendingProviderName } from "@/types/email-sending";

type CampaignRow = Database["public"]["Tables"]["outreach_campaigns"]["Row"];
type CampaignInsert = Database["public"]["Tables"]["outreach_campaigns"]["Insert"];

export function toCampaignInsert(
  userId: string,
  input: {
    name: string;
    provider: EmailSendingProviderName;
    totalCount: number;
  }
): CampaignInsert {
  return {
    user_id: userId,
    name: input.name,
    provider: input.provider,
    status: "running",
    total_count: input.totalCount,
    sent_count: 0,
    failed_count: 0,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function toOutreachCampaign(row: CampaignRow): OutreachCampaign {
  return {
    id: row.id,
    name: row.name,
    status: row.status as OutreachCampaign["status"],
    provider: row.provider as EmailSendingProviderName,
    totalCount: row.total_count,
    sentCount: row.sent_count,
    failedCount: row.failed_count,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}
