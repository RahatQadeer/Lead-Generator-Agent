import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon: LucideIcon;
  label: string;
  title: string;
  description?: string;
}

export function PageHeader({
  icon: Icon,
  label,
  title,
  description,
}: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 text-cyan-400">
        <Icon className="h-5 w-5" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-2xl text-slate-400">{description}</p>
      )}
    </div>
  );
}
