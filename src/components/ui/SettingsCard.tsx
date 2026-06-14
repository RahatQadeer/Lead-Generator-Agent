import {
  headingSubsectionClassName,
  settingsCardClassName,
  textSecondaryClassName,
} from "@/lib/ui/styles";
import type { LucideIcon } from "lucide-react";

interface SettingsCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsCard({
  icon: Icon,
  iconClassName = "bg-gradient-to-br from-violet-50 to-purple-100 text-violet-700",
  title,
  description,
  children,
}: SettingsCardProps) {
  return (
    <div className={settingsCardClassName}>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className={headingSubsectionClassName}>{title}</h2>
          {description && (
            <p className={`mt-1 ${textSecondaryClassName}`}>{description}</p>
          )}
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
