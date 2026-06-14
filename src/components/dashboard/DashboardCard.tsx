import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  metricAccentStyles,
  metricGlowClassName,
  type MetricAccent,
} from "@/components/dashboard/metric-accent";
import {
  dashboardCardClassName,
  dashboardCardIconClassName,
  dashboardCardPaddingClassName,
  headingSectionClassName,
} from "@/lib/ui/styles";

interface DashboardCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  viewAllHref?: string;
  accent?: MetricAccent;
  children: React.ReactNode;
  className?: string;
}

export function DashboardCard({
  title,
  description,
  icon: Icon,
  action,
  viewAllHref,
  accent,
  children,
  className = "",
}: DashboardCardProps) {
  const headerAction =
    action ??
    (viewAllHref ? (
      <Link
        href={viewAllHref}
        className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
      >
        View all
      </Link>
    ) : undefined);

  const glow = accent ? metricAccentStyles[accent].glow : null;

  return (
    <section
      className={`relative overflow-hidden ${dashboardCardClassName} ${className}`.trim()}
    >
      {glow && (
        <div
          className={`${metricGlowClassName} h-32 ${glow}`}
          aria-hidden
        />
      )}

      <div className={`relative ${dashboardCardPaddingClassName}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {Icon && (
              <div
                className={
                  accent
                    ? `${dashboardCardIconClassName} !h-9 !w-9 rounded-full ${metricAccentStyles[accent].icon}`
                    : "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-gray-200/80 bg-gray-50 text-gray-600"
                }
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
            )}
            <div className="min-w-0 pt-0.5">
              <h2 className={headingSectionClassName}>{title}</h2>
              {description && (
                <p className="mt-1 text-sm leading-relaxed text-gray-500">
                  {description}
                </p>
              )}
            </div>
          </div>
          {headerAction && (
            <div className="shrink-0 pt-1">{headerAction}</div>
          )}
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}
