import {
  LayoutDashboard,
  Users,
  Send,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  cardClassName,
  cardPaddingClassName,
  headingSectionClassName,
  iconTileSmClassName,
  pillActiveClassName,
  pillInactiveClassName,
} from "@/lib/ui/styles";

export default async function DashboardPage() {
  const { profile } = await getAuthContext();
  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        label="Dashboard"
        title={`Welcome back, ${firstName}`}
        description="Your AI-powered sales assistant is ready. Start discovering leads and automating outreach from here."
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Leads found"
          value="—"
          hint="Run your first search"
          trend="+0%"
          trendUp
        />
        <StatCard
          icon={Send}
          label="Emails sent"
          value="—"
          hint="No campaigns yet"
          trend="—"
        />
        <StatCard
          icon={MessageSquare}
          label="Replies"
          value="—"
          hint="Awaiting outreach"
          trend="—"
        />
        <StatCard
          icon={TrendingUp}
          label="Conversion rate"
          value="—"
          hint="Track performance here"
          trend="—"
        />
      </div>

      <div className={`${cardClassName} ${cardPaddingClassName} mt-8`}>
        <h2 className={headingSectionClassName}>Getting started</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Define target companies, discover decision-makers, and launch
          AI-personalized outreach — all from this platform.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <StepBadge step={1} label="Define search criteria" done />
          <StepBadge step={2} label="Discover companies" />
          <StepBadge step={3} label="Find contacts" />
          <StepBadge step={4} label="Send outreach" />
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  trend,
  trendUp,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  trend: string;
  trendUp?: boolean;
}) {
  return (
    <div
      className={`${cardClassName} p-5 transition-shadow hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={iconTileSmClassName}>
          <Icon className="h-4 w-4" />
        </div>
        {trend !== "—" && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              trendUp
                ? "bg-emerald-50 text-emerald-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{hint}</p>
    </div>
  );
}

function StepBadge({
  step,
  label,
  done,
}: {
  step: number;
  label: string;
  done?: boolean;
}) {
  return (
    <div className={done ? pillActiveClassName : pillInactiveClassName}>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
          done ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
        }`}
      >
        {step}
      </span>
      {label}
    </div>
  );
}
