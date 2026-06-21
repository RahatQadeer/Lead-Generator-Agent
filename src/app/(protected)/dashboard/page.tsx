import {
  LayoutDashboard,
  Users,
  Send,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { PageHeader } from "@/components/layout/PageHeader";

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Leads found"
          value="—"
          hint="Run your first search"
        />
        <StatCard
          icon={Send}
          label="Emails sent"
          value="—"
          hint="No campaigns yet"
        />
        <StatCard
          icon={MessageSquare}
          label="Replies"
          value="—"
          hint="Awaiting outreach"
        />
        <StatCard
          icon={TrendingUp}
          label="Conversion rate"
          value="—"
          hint="Track performance here"
        />
      </div>

      <div className="mt-8 rounded-2xl border border-white/5 bg-slate-900/50 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-white">Getting started</h2>
        <p className="mt-2 text-sm text-slate-400">
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/50 p-5 transition-colors hover:border-white/10">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
          <Icon className="h-4 w-4 text-cyan-400" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
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
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
        done
          ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
          : "border-white/5 bg-white/5 text-slate-400"
      }`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
          done ? "bg-cyan-500 text-white" : "bg-white/10 text-slate-500"
        }`}
      >
        {step}
      </span>
      {label}
    </div>
  );
}
