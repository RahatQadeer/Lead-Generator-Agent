import type { LucideIcon } from "lucide-react";

interface DashboardStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  accent?: "cyan" | "violet" | "emerald" | "amber";
}

const accentStyles = {
  cyan: {
    icon: "bg-cyan-500/10 text-cyan-400",
    value: "text-white",
  },
  violet: {
    icon: "bg-violet-500/10 text-violet-400",
    value: "text-white",
  },
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-400",
    value: "text-white",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-400",
    value: "text-white",
  },
};

export function DashboardStatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "cyan",
}: DashboardStatCardProps) {
  const styles = accentStyles[accent];

  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/50 p-5 transition-colors hover:border-white/10">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">{label}</span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${styles.icon}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={`mt-3 text-2xl font-bold ${styles.value}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
