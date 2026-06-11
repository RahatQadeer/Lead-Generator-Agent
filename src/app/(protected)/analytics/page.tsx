import { BarChart3 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { DashboardStatsPanelWithSearches } from "@/components/dashboard/DashboardStatsPanel";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { LeadMetricsPanel } from "@/components/dashboard/LeadMetricsPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getLeadMetrics } from "@/lib/dashboard/lead-metrics";
import { getDashboardStats } from "@/lib/dashboard/queries";
import {
  formatConversionRate,
  formatStatValue,
} from "@/lib/dashboard/format";

export default async function AnalyticsPage() {
  const { user } = await getAuthContext();
  const [stats, leadMetrics] = await Promise.all([
    getDashboardStats(user.id),
    getLeadMetrics(user.id),
  ]);
  const hasData =
    stats.emailsSent > 0 ||
    leadMetrics.discoveredCount > 0 ||
    stats.leadCount > 0;

  return (
    <>
      <PageHeader
        icon={BarChart3}
        label="Analytics"
        title="Performance insights"
        description="Track leads found, emails sent, replies received, and conversion rates."
      />

      <DashboardLayout stats={<DashboardStatsPanelWithSearches stats={stats} />}>
        {hasData ? (
          <div className="space-y-6">
            <LeadMetricsPanel metrics={leadMetrics} />
            <DashboardSection
              title="Outreach performance"
              description="Email and campaign activity across your pipeline."
            >
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Metric
                  label="Emails sent"
                  value={formatStatValue(stats.emailsSent)}
                />
                <Metric
                  label="Replies"
                  value={formatStatValue(stats.replyCount)}
                />
                <Metric
                  label="Conversion rate"
                  value={formatConversionRate(stats.conversionRate)}
                />
                <Metric
                  label="Draft emails"
                  value={formatStatValue(stats.draftCount)}
                />
                <Metric
                  label="Campaigns"
                  value={formatStatValue(stats.campaignCount)}
                />
                <Metric
                  label="Contacts paused"
                  value={formatStatValue(leadMetrics.pausedCount)}
                />
              </dl>
            </DashboardSection>
          </div>
        ) : (
          <EmptyState
            icon={BarChart3}
            title="No data yet"
            description="Analytics will populate once you start running searches and sending outreach campaigns."
          />
        )}
      </DashboardLayout>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-white">{value}</dd>
    </div>
  );
}
