import { Calendar, MessageSquare, Send, TrendingUp, Users } from "lucide-react";
import {
  DashboardKpiStrip,
  type DashboardKpiItem,
} from "@/components/dashboard/DashboardKpiStrip";
import {
  formatConversionRate,
  formatStatValue,
} from "@/lib/dashboard/format";
import { headingPageClassName, textSecondaryClassName } from "@/lib/ui/styles";
import type { DashboardStats } from "@/types/dashboard";

interface DashboardOverviewProps {
  firstName: string;
  stats: DashboardStats;
  nested?: boolean;
}

export function buildDashboardKpiItems(stats: DashboardStats): DashboardKpiItem[] {
  return [
    {
      icon: Users,
      label: "Leads enriched",
      value: formatStatValue(stats.leadCount),
      detail:
        stats.leadCount > 0
          ? `${stats.searchCount} active search${stats.searchCount === 1 ? "" : "es"}`
          : "Run discovery from your searches",
      accent: "violet",
    },
    {
      icon: Send,
      label: "Emails sent",
      value: formatStatValue(stats.emailsSent),
      detail:
        stats.emailsSent > 0
          ? `${stats.campaignCount} campaign${stats.campaignCount === 1 ? "" : "s"} launched`
          : stats.draftCount > 0
            ? `${stats.draftCount} draft${stats.draftCount === 1 ? "" : "s"} ready`
            : "Generate outreach from Leads",
      accent: "sky",
    },
    {
      icon: MessageSquare,
      label: "Replies",
      value: formatStatValue(stats.replyCount),
      detail:
        stats.replyCount > 0
          ? "Prospects engaged"
          : stats.emailsSent > 0
            ? "Check Emails for responses"
            : "Waiting on first send",
      accent: "emerald",
    },
    {
      icon: TrendingUp,
      label: "Conversion",
      value: formatConversionRate(stats.conversionRate),
      detail:
        stats.conversionRate !== null
          ? "Reply rate on sent emails"
          : "Track once campaigns are live",
      accent: "amber",
    },
  ];
}

function formatTodayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function DashboardOverview({
  firstName,
  stats,
  nested = false,
}: DashboardOverviewProps) {
  const today = formatTodayLabel();

  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <h1 className={headingPageClassName}>Welcome back, {firstName}</h1>
        {nested && (
          <p className={`mt-1.5 max-w-xl text-sm ${textSecondaryClassName}`}>
            Your pipeline snapshot — leads, outreach, and replies in one place.
          </p>
        )}
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500">
          <Calendar
            className="h-3.5 w-3.5 text-gray-400"
            strokeWidth={1.75}
          />
          {today}
        </p>
      </div>

      <DashboardKpiStrip items={buildDashboardKpiItems(stats)} />
    </div>
  );
}
