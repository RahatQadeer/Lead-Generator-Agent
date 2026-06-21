import type { LucideIcon } from "lucide-react";

export interface EmailFollowUpStat {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}

interface EmailFollowUpBarProps {
  items: EmailFollowUpStat[];
}

export function EmailFollowUpBar({ items }: EmailFollowUpBarProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/60">
      <div className="grid grid-cols-3 divide-x divide-gray-200/70">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="px-3 py-3 text-center sm:px-4">
              <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-white text-gray-500 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-[11px] font-medium leading-tight text-gray-500">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-bold leading-none tabular-nums text-gray-950">
                {item.value}
              </p>
              <p className="mt-1 text-[10px] leading-tight text-gray-400">
                {item.hint}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
