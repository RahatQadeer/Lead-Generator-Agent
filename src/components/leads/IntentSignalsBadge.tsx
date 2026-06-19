import type { IntentSignal } from "@/types/intent-signals";

interface IntentSignalsBadgeProps {
  score: number | null;
  signals?: IntentSignal[] | null;
  compact?: boolean;
}

const STRENGTH_CLASS: Record<IntentSignal["strength"], string> = {
  high: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  medium: "bg-amber-50 text-amber-800 ring-amber-100",
  low: "bg-gray-50 text-gray-700 ring-gray-100",
};

export function IntentSignalsBadge({
  score,
  signals,
  compact = false,
}: IntentSignalsBadgeProps) {
  if (!score || score < 20 || !signals?.length) return null;

  const top = signals.slice(0, compact ? 1 : 2);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-100">
        Intent {score}%
      </span>
      {top.map((signal) => (
        <span
          key={signal.id}
          title={signal.evidence}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${STRENGTH_CLASS[signal.strength]}`}
        >
          {signal.label}
        </span>
      ))}
    </div>
  );
}
