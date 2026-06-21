import {
  headingPageClassName,
  textEyebrowClassName,
  textSecondaryClassName,
} from "@/lib/ui/styles";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon: LucideIcon;
  label?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({
  icon: _Icon,
  label,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        {label && <p className={textEyebrowClassName}>{label}</p>}
        <h1 className={`${label ? "mt-2" : ""} ${headingPageClassName}`}>
          {title}
        </h1>
        {description && (
          <p className={`mt-3 max-w-2xl ${textSecondaryClassName}`}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
