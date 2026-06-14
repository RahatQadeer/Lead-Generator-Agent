import { DashboardUnified } from "@/components/dashboard/DashboardUnified";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getRecentActivity } from "@/lib/dashboard/activity-feed";
import { getConversionMetrics } from "@/lib/dashboard/conversion-metrics";
import { getEmailMetrics } from "@/lib/dashboard/email-metrics";
import { getLeadMetrics } from "@/lib/dashboard/lead-metrics";
import {
  getDashboardStats,
  getOnboardingSteps,
} from "@/lib/dashboard/queries";

export default async function DashboardPage() {
  const { profile, user } = await getAuthContext();
  const [stats, leadMetrics, emailMetrics, conversionMetrics, activities] =
    await Promise.all([
      getDashboardStats(user.id),
      getLeadMetrics(user.id),
      getEmailMetrics(user.id),
      getConversionMetrics(user.id),
      getRecentActivity(user.id),
    ]);
  const steps = getOnboardingSteps(stats);
  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  return (
    <DashboardUnified
      firstName={firstName}
      stats={stats}
      leadMetrics={leadMetrics}
      emailMetrics={emailMetrics}
      conversionMetrics={conversionMetrics}
      activities={activities}
      steps={steps}
    />
  );
}
