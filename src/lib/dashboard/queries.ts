import { getCampaignSummary } from "@/lib/email-campaigns/queries";
import { getReplySummary } from "@/lib/reply-tracking/queries";
import { createClient } from "@/lib/supabase/server";
import type { DashboardOnboardingStep, DashboardStats } from "@/types/dashboard";

export async function getDashboardStats(
  userId: string
): Promise<DashboardStats> {
  const supabase = await createClient();

  const [searches, leads, replySummary, campaignSummary] = await Promise.all([
    supabase
      .from("searches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("enriched_at", "is", null),
    getReplySummary(userId),
    getCampaignSummary(userId),
  ]);

  const emailsSent = replySummary.sentCount;
  const replyCount = replySummary.repliedCount;
  const conversionRate =
    emailsSent > 0 ? Math.round((replyCount / emailsSent) * 100) : null;

  return {
    searchCount: searches.count ?? 0,
    leadCount: leads.count ?? 0,
    emailsSent,
    replyCount,
    conversionRate,
    draftCount: campaignSummary.draftCount,
    campaignCount: campaignSummary.campaignCount,
  };
}

export function getOnboardingSteps(
  stats: DashboardStats
): DashboardOnboardingStep[] {
  return [
    {
      step: 1,
      label: "Define search criteria",
      done: stats.searchCount > 0,
      href: "/searches",
    },
    {
      step: 2,
      label: "Discover companies",
      done: stats.searchCount > 0,
      href: "/searches",
    },
    {
      step: 3,
      label: "Find & enrich leads",
      done: stats.leadCount > 0,
      href: "/leads",
    },
    {
      step: 4,
      label: "Send outreach",
      done: stats.emailsSent > 0,
      href: "/emails",
    },
  ];
}
