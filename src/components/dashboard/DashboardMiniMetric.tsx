import {
  metricAccentStyles,
  metricGlowClassName,
  type MetricAccent,
} from "@/components/dashboard/metric-accent";
import { dashboardStatCardClassName } from "@/lib/ui/styles";
import type { LucideIcon } from "lucide-react";

interface DashboardMiniMetricProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  accent?: MetricAccent;
}

export function DashboardMiniMetric({
  icon: Icon,
  label,
  value,
  hint,
  accent = "violet",
}: DashboardMiniMetricProps) {
  const styles = metricAccentStyles[accent];

  return (
    <article className={`${dashboardStatCardClassName} p-4`}>
      <div
        className={`${metricGlowClassName} ${styles.glow}`}
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${styles.icon}`}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
      </div>

      <p className="relative mt-3 text-center text-[1.625rem] font-bold leading-none tracking-[-0.03em] text-gray-950 tabular-nums">
        {value}
      </p>

      <p className="relative mt-2 text-center text-xs leading-relaxed text-gray-500">
        {hint}
      </p>
    </article>
  );
}
