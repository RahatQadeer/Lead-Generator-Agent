interface DashboardStatsGridProps {
  children: React.ReactNode;
}

export function DashboardStatsGrid({ children }: DashboardStatsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  );
}
