import { toCampaignInsert, toOutreachCampaign } from "@/lib/email-campaigns/mapper";
import { createClient } from "@/lib/supabase/server";
import type {
  CampaignSummary,
  OutreachCampaign,
  OutreachCampaignStatus,
} from "@/types/email-campaign";
import type { EmailSendingProviderName } from "@/types/email-sending";

export async function createOutreachCampaign(
  userId: string,
  input: {
    name: string;
    provider: EmailSendingProviderName;
    totalCount: number;
  }
): Promise<OutreachCampaign | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outreach_campaigns")
    .insert(toCampaignInsert(userId, input))
    .select("*")
    .single();

  if (error || !data) return null;

  return toOutreachCampaign(data);
}

export async function updateOutreachCampaignProgress(
  userId: string,
  campaignId: string,
  input: {
    sentCount: number;
    failedCount: number;
    status: OutreachCampaignStatus;
    completedAt?: string | null;
  }
): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("outreach_campaigns")
    .update({
      sent_count: input.sentCount,
      failed_count: input.failedCount,
      status: input.status,
      completed_at: input.completedAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("user_id", userId);
}

export async function getOutreachCampaignsByUserId(
  userId: string,
  limit = 10
): Promise<OutreachCampaign[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outreach_campaigns")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map(toOutreachCampaign);
}

export async function getCampaignSummary(
  userId: string
): Promise<CampaignSummary> {
  const supabase = await createClient();

  const [drafts, sent, campaigns] = await Promise.all([
    supabase
      .from("outreach_emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "draft"),
    supabase
      .from("outreach_emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "sent"),
    supabase
      .from("outreach_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  return {
    draftCount: drafts.count ?? 0,
    sentCount: sent.count ?? 0,
    campaignCount: campaigns.count ?? 0,
  };
}
