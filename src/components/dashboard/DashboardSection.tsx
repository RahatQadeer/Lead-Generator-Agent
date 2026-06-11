interface DashboardSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function DashboardSection({
  title,
  description,
  children,
}: DashboardSectionProps) {
  return (
    <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}
