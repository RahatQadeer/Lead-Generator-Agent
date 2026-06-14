import { metricTileClassName } from "@/lib/ui/styles";
import type { LucideIcon } from "lucide-react";

interface DashboardStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  accent?: "violet" | "emerald" | "amber" | "slate";
}

const accentStyles = {
  violet: "bg-violet-50 text-violet-700",
  slate: "bg-gray-100 text-gray-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
};

export function DashboardStatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "violet",
}: DashboardStatCardProps) {
  return (
    <div className={`${metricTileClassName} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium tracking-wide text-gray-400">
          {label}
        </span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentStyles[accent]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-[-0.02em] text-gray-950">
        {value}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-gray-400">{hint}</p>
    </div>
  );
}
