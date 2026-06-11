import {
  getCampaignSummary,
  getOutreachCampaignsByUserId,
} from "@/lib/email-campaigns/queries";
import { getToneLabel } from "@/lib/email-generation/tone-guidance";
import { parseEmailTone } from "@/lib/email-generation/parse-tone";
import { getFollowUpSummary } from "@/lib/follow-ups/queries";
import { createClient } from "@/lib/supabase/server";
import type { EmailMetrics, EmailToneMetric } from "@/types/dashboard";
import { EMAIL_TONES } from "@/types/email-generation";

type EmailMetricRow = {
  id: string;
  status: string;
  tone: string;
  reply_status: string;
  subject: string;
  replied_at: string | null;
  reply_snippet: string | null;
  contacts: { full_name: string } | null;
};

function buildToneBreakdown(emails: EmailMetricRow[]): EmailToneMetric[] {
  const counts = new Map<string, number>();

  for (const email of emails) {
    const tone = parseEmailTone(email.tone);
    counts.set(tone, (counts.get(tone) ?? 0) + 1);
  }

  return EMAIL_TONES.map((tone) => ({
    tone,
    label: getToneLabel(tone),
    count: counts.get(tone) ?? 0,
  })).filter((item) => item.count > 0);
}

export async function getEmailMetrics(userId: string): Promise<EmailMetrics> {
  const supabase = await createClient();

  const [emailsResult, campaigns, campaignSummary, followUpSummary, suggestionsResult] =
    await Promise.all([
      supabase
        .from("outreach_emails")
        .select(
          "id, status, tone, reply_status, subject, replied_at, reply_snippet, contacts(full_name)"
        )
        .eq("user_id", userId),
      getOutreachCampaignsByUserId(userId, 5),
      getCampaignSummary(userId),
      getFollowUpSummary(userId),
      supabase
        .from("follow_ups")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("suggested_at", "is", null),
    ]);

  if (emailsResult.error || !emailsResult.data) {
    return emptyEmailMetrics();
  }

  const emails = emailsResult.data as EmailMetricRow[];
  const drafts = emails.filter((e) => e.status === "draft");
  const sent = emails.filter((e) => e.status === "sent");
  const replied = emails.filter((e) => e.reply_status === "replied");
  const awaiting = sent.filter((e) => e.reply_status === "none");

  const sentCount = sent.length;
  const repliedCount = replied.length;
  const conversionRate =
    sentCount > 0 ? Math.round((repliedCount / sentCount) * 100) : null;

  const campaignEmailsSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
  const campaignEmailsFailed = campaigns.reduce(
    (sum, c) => sum + c.failedCount,
    0
  );

  const recentReplies = [...replied]
    .filter((e) => e.replied_at)
    .sort(
      (a, b) =>
        new Date(b.replied_at as string).getTime() -
        new Date(a.replied_at as string).getTime()
    )
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      subject: e.subject,
      leadName: e.contacts?.full_name ?? "Unknown",
      repliedAt: e.replied_at as string,
      snippet: e.reply_snippet,
    }));

  return {
    generatedCount: emails.length,
    draftCount: drafts.length,
    sentCount,
    repliedCount,
    awaitingReplyCount: awaiting.length,
    conversionRate,
    campaignCount: campaignSummary.campaignCount,
    campaignEmailsSent,
    campaignEmailsFailed,
    followUpScheduled: followUpSummary.scheduledCount,
    followUpCancelled: followUpSummary.cancelledCount,
    followUpWithSuggestion: suggestionsResult.count ?? 0,
    toneBreakdown: buildToneBreakdown(emails),
    recentCampaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      sentCount: c.sentCount,
      totalCount: c.totalCount,
      failedCount: c.failedCount,
    })),
    recentReplies,
  };
}

function emptyEmailMetrics(): EmailMetrics {
  return {
    generatedCount: 0,
    draftCount: 0,
    sentCount: 0,
    repliedCount: 0,
    awaitingReplyCount: 0,
    conversionRate: null,
    campaignCount: 0,
    campaignEmailsSent: 0,
    campaignEmailsFailed: 0,
    followUpScheduled: 0,
    followUpCancelled: 0,
    followUpWithSuggestion: 0,
    toneBreakdown: [],
    recentCampaigns: [],
    recentReplies: [],
  };
}
