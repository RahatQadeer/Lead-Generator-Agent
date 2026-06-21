interface DashboardLayoutProps {
  stats: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
}

export function DashboardLayout({
  stats,
  children,
  aside,
}: DashboardLayoutProps) {
  return (
    <div className="space-y-8">
      <section aria-label="Key metrics">{stats}</section>

      <div
        className={
          aside
            ? "grid gap-6 lg:grid-cols-3 lg:items-start"
            : "grid gap-6"
        }
      >
        <div className={aside ? "space-y-6 lg:col-span-2" : "space-y-6"}>
          {children}
        </div>
        {aside && (
          <aside className="space-y-6 lg:col-span-1">{aside}</aside>
        )}
      </div>
    </div>
  );
}
