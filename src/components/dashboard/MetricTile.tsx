import { metricTileClassName } from "@/lib/ui/styles";
import type { LucideIcon } from "lucide-react";

const accentStyles = {
  violet: "bg-violet-50 text-violet-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
};

interface MetricTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  accent?: keyof typeof accentStyles;
  flat?: boolean;
}

export function MetricTile({
  icon: Icon,
  label,
  value,
  hint,
  accent = "violet",
  flat = false,
}: MetricTileProps) {
  return (
    <div className={flat ? "min-w-0" : metricTileClassName}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${accentStyles[accent]}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-[-0.02em] text-gray-900">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
    </div>
  );
}

export function SecondaryMetric({
  label,
  value,
  flat = false,
}: {
  label: string;
  value: string;
  flat?: boolean;
}) {
  return (
    <div
      className={
        flat
          ? "min-w-0"
          : "rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
      }
    >
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}
