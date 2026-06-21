import type { LucideIcon } from "lucide-react";

interface IntegrationTileProps {
  name: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  selected?: boolean;
  statusLabel?: string;
  onManage: () => void;
}

export function IntegrationTile({
  name,
  description,
  icon: Icon,
  iconClassName,
  selected = false,
  statusLabel,
  onManage,
}: IntegrationTileProps) {
  return (
    <div
      className={`flex flex-col bg-white p-5 transition-colors ${
        selected ? "bg-gray-50/80" : "hover:bg-gray-50/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{name}</h3>
            {statusLabel && (
              <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                {statusLabel}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onManage}
        className="mx-auto mt-4 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
      >
        Manage
      </button>
    </div>
  );
}
