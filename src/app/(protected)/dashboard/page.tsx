import { LayoutDashboard } from "lucide-react";
import { DashboardGettingStarted } from "@/components/dashboard/DashboardGettingStarted";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { DashboardQuickLinks } from "@/components/dashboard/DashboardQuickLinks";
import { DashboardStatsPanel } from "@/components/dashboard/DashboardStatsPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import {
  getDashboardStats,
  getOnboardingSteps,
} from "@/lib/dashboard/queries";

export default async function DashboardPage() {
  const { profile, user } = await getAuthContext();
  const stats = await getDashboardStats(user.id);
  const steps = getOnboardingSteps(stats);
  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        label="Dashboard"
        title={`Welcome back, ${firstName}`}
        description="Your AI-powered sales assistant is ready. Start discovering leads and automating outreach from here."
      />

      <DashboardLayout
        stats={<DashboardStatsPanel stats={stats} />}
        aside={<DashboardQuickLinks />}
      >
        <DashboardGettingStarted steps={steps} />
      </DashboardLayout>
    </>
  );
}
