import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { MetricAccent } from "@/components/dashboard/metric-accent";
import type { LucideIcon } from "lucide-react";

interface DashboardPanelShellProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  viewAllHref?: string;
  accent?: MetricAccent;
  children: React.ReactNode;
  className?: string;
}

export function DashboardPanelShell({
  title,
  description,
  icon,
  action,
  viewAllHref,
  accent,
  children,
  className,
}: DashboardPanelShellProps) {
  return (
    <DashboardCard
      title={title}
      description={description}
      icon={icon}
      action={action}
      viewAllHref={viewAllHref}
      accent={accent}
      className={className}
    >
      {children}
    </DashboardCard>
  );
}
