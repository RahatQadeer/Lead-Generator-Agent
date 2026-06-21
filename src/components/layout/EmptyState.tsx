import { cardClassName, iconTileClassName } from "@/lib/ui/styles";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div
      className={`${cardClassName} flex flex-col items-center justify-center border-dashed px-6 py-16 text-center`}
    >
      <div className={iconTileClassName}>
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">
        {description}
      </p>
    </div>
  );
}
