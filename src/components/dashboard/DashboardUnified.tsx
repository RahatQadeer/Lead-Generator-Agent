import { DashboardGettingStarted } from "@/components/dashboard/DashboardGettingStarted";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import { ConversionMetricsPanel } from "@/components/dashboard/ConversionMetricsPanel";
import { EmailMetricsPanel } from "@/components/dashboard/EmailMetricsPanel";
import { LeadMetricsPanel } from "@/components/dashboard/LeadMetricsPanel";
import type {
  ActivityItem,
  ConversionMetrics,
  DashboardOnboardingStep,
  DashboardStats,
  EmailMetrics,
  LeadMetrics,
} from "@/types/dashboard";

interface DashboardUnifiedProps {
  firstName: string;
  stats: DashboardStats;
  leadMetrics: LeadMetrics;
  emailMetrics: EmailMetrics;
  conversionMetrics: ConversionMetrics;
  activities: ActivityItem[];
  steps: DashboardOnboardingStep[];
}

export function DashboardUnified({
  firstName,
  stats,
  leadMetrics,
  emailMetrics,
  conversionMetrics,
  activities,
  steps,
}: DashboardUnifiedProps) {
  const allStepsDone = steps.every((step) => step.done);

  return (
    <div className="space-y-6">
      <DashboardOverview nested firstName={firstName} stats={stats} />

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          <LeadMetricsPanel metrics={leadMetrics} />
          {!allStepsDone && <DashboardGettingStarted steps={steps} />}
        </div>

        <aside className="lg:col-span-1">
          <RecentActivityFeed activities={activities} />
        </aside>
      </div>

      <EmailMetricsPanel metrics={emailMetrics} />
      <ConversionMetricsPanel metrics={conversionMetrics} />
    </div>
  );
}
