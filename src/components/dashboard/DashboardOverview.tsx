import { Building2, Calendar, Search, Users, Contact } from "lucide-react";
import {
  DashboardKpiStrip,
  type DashboardKpiItem,
} from "@/components/dashboard/DashboardKpiStrip";
import { formatStatValue } from "@/lib/dashboard/format";
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
      icon: Building2,
      label: "Companies found",
      value: formatStatValue(stats.companyCount),
      detail:
        stats.companyCount > 0
          ? "Across all searches"
          : "Run a search to discover companies",
      accent: "sky",
    },
    {
      icon: Contact,
      label: "With contact details",
      value: formatStatValue(stats.contactedLeadCount),
      detail:
        stats.contactedLeadCount > 0
          ? "Email, LinkedIn or phone resolved"
          : "Enrich leads to collect contacts",
      accent: "emerald",
    },
    {
      icon: Search,
      label: "Saved searches",
      value: formatStatValue(stats.searchCount),
      detail:
        stats.searchCount > 0
          ? "Rerun any search to refresh results"
          : "Create your first search",
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
