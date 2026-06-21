import {
  MessageSquare,
  Search,
  Send,
  TrendingUp,
  Users,
} from "lucide-react";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import { DashboardStatsGrid } from "@/components/dashboard/DashboardStatsGrid";
import {
  formatConversionRate,
  formatStatValue,
} from "@/lib/dashboard/format";
import type { DashboardStats } from "@/types/dashboard";

interface DashboardStatsPanelProps {
  stats: DashboardStats;
}

export function DashboardStatsPanel({ stats }: DashboardStatsPanelProps) {
  return (
    <DashboardStatsGrid>
      <DashboardStatCard
        icon={Users}
        label="Leads enriched"
        value={formatStatValue(stats.leadCount)}
        hint={
          stats.leadCount > 0
            ? `${stats.searchCount} search${stats.searchCount === 1 ? "" : "es"}`
            : "Discover contacts from searches"
        }
        accent="violet"
      />
      <DashboardStatCard
        icon={Send}
        label="Emails sent"
        value={formatStatValue(stats.emailsSent)}
        hint={
          stats.emailsSent > 0
            ? `${stats.campaignCount} campaign${stats.campaignCount === 1 ? "" : "s"}`
            : stats.draftCount > 0
              ? `${stats.draftCount} draft${stats.draftCount === 1 ? "" : "s"} ready`
              : "No campaigns yet"
        }
        accent="cyan"
      />
      <DashboardStatCard
        icon={MessageSquare}
        label="Replies"
        value={formatStatValue(stats.replyCount)}
        hint={
          stats.replyCount > 0
            ? "Leads responded"
            : stats.emailsSent > 0
              ? "Check Emails page"
              : "Awaiting outreach"
        }
        accent="emerald"
      />
      <DashboardStatCard
        icon={TrendingUp}
        label="Conversion rate"
        value={formatConversionRate(stats.conversionRate)}
        hint={
          stats.conversionRate !== null
            ? "Replies ÷ emails sent"
            : "Send outreach to track"
        }
        accent="amber"
      />
    </DashboardStatsGrid>
  );
}

export function DashboardStatsPanelWithSearches({
  stats,
}: DashboardStatsPanelProps) {
  return (
    <DashboardStatsGrid>
      <DashboardStatCard
        icon={Search}
        label="Saved searches"
        value={formatStatValue(stats.searchCount)}
        hint={
          stats.searchCount > 0 ? "Active criteria" : "Create your first search"
        }
        accent="cyan"
      />
      <DashboardStatCard
        icon={Users}
        label="Leads enriched"
        value={formatStatValue(stats.leadCount)}
        hint={
          stats.leadCount > 0 ? "Ready for outreach" : "Enrich from Leads page"
        }
        accent="violet"
      />
      <DashboardStatCard
        icon={Send}
        label="Emails sent"
        value={formatStatValue(stats.emailsSent)}
        hint={
          stats.emailsSent > 0 ? "Outreach delivered" : "No campaigns yet"
        }
        accent="cyan"
      />
      <DashboardStatCard
        icon={MessageSquare}
        label="Replies"
        value={formatStatValue(stats.replyCount)}
        hint={
          stats.replyCount > 0
            ? "Leads responded"
            : stats.emailsSent > 0
              ? "Check Emails page"
              : "Awaiting outreach"
        }
        accent="emerald"
      />
    </DashboardStatsGrid>
  );
}
