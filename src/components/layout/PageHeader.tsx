import {
  headingPageClassName,
  iconTileSmClassName,
  textSecondaryClassName,
} from "@/lib/ui/styles";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon: LucideIcon;
  label: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({
  icon: Icon,
  label,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className={iconTileSmClassName}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium text-blue-600">{label}</span>
        </div>
        <h1 className={`mt-3 ${headingPageClassName}`}>{title}</h1>
        {description && (
          <p className={`mt-2 max-w-2xl ${textSecondaryClassName}`}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
