import { DashboardUnified } from "@/components/dashboard/DashboardUnified";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getRecentActivity } from "@/lib/dashboard/activity-feed";
import { getLeadMetrics } from "@/lib/dashboard/lead-metrics";
import {
  getDashboardStats,
  getOnboardingSteps,
} from "@/lib/dashboard/queries";

export default async function DashboardPage() {
  const { profile, user } = await getAuthContext();
  const [stats, leadMetrics, activities] = await Promise.all([
    getDashboardStats(user.id),
    getLeadMetrics(user.id),
    getRecentActivity(user.id),
  ]);
  const steps = getOnboardingSteps(stats);
  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  return (
    <DashboardUnified
      firstName={firstName}
      stats={stats}
      leadMetrics={leadMetrics}
      activities={activities}
      steps={steps}
    />
  );
}
