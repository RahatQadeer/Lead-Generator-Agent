import { BarChart3 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { DashboardStatsPanelWithSearches } from "@/components/dashboard/DashboardStatsPanel";
import { EmailMetricsPanel } from "@/components/dashboard/EmailMetricsPanel";
import { LeadMetricsPanel } from "@/components/dashboard/LeadMetricsPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getEmailMetrics } from "@/lib/dashboard/email-metrics";
import { getLeadMetrics } from "@/lib/dashboard/lead-metrics";
import { getDashboardStats } from "@/lib/dashboard/queries";

export default async function AnalyticsPage() {
  const { user } = await getAuthContext();
  const [stats, leadMetrics, emailMetrics] = await Promise.all([
    getDashboardStats(user.id),
    getLeadMetrics(user.id),
    getEmailMetrics(user.id),
  ]);
  const hasData =
    stats.emailsSent > 0 ||
    leadMetrics.discoveredCount > 0 ||
    emailMetrics.generatedCount > 0;

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
            <EmailMetricsPanel metrics={emailMetrics} />
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
