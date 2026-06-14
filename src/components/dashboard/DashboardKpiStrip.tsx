import {
  metricAccentStyles,
  metricGlowClassName,
  type MetricAccent,
} from "@/components/dashboard/metric-accent";
import {
  dashboardStatCardClassName,
  headingSubsectionClassName,
} from "@/lib/ui/styles";
import type { LucideIcon } from "lucide-react";

export interface DashboardKpiItem {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  accent: MetricAccent;
}

interface DashboardKpiStripProps {
  items: DashboardKpiItem[];
  title?: string;
}

export function DashboardKpiStrip({
  items,
  title = "Pipeline overview",
}: DashboardKpiStripProps) {
  return (
    <div>
      <p className={headingSubsectionClassName}>{title}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const accent = metricAccentStyles[item.accent];

          return (
            <article
              key={item.label}
              className={`${dashboardStatCardClassName} p-4`}
            >
              <div
                className={`${metricGlowClassName} ${accent.glow}`}
                aria-hidden
              />

              <div className="relative flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-600">{item.label}</p>
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${accent.icon}`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                </div>
              </div>

              <p className="relative mt-3 text-center text-[1.625rem] font-bold leading-none tracking-[-0.03em] text-gray-950 tabular-nums">
                {item.value}
              </p>

              <p className="relative mt-2 text-center text-xs leading-relaxed text-gray-500">
                {item.detail}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
