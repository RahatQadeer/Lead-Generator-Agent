import { Clock } from "lucide-react";
import { DEFAULT_FOLLOW_UP_DELAY_DAYS } from "@/lib/follow-ups/constants";
import { cardClassName } from "@/lib/ui/styles";
import type { FollowUpSummary } from "@/types/follow-up";

interface FollowUpsPanelProps {
  summary: FollowUpSummary;
}

export function FollowUpsPanel({ summary }: FollowUpsPanelProps) {
  if (
    summary.scheduledCount === 0 &&
    summary.cancelledCount === 0 &&
    summary.pausedContactCount === 0
  ) {
    return null;
  }

  return (
    <div className={`${cardClassName} p-5 sm:p-6`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
          <Clock className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Follow-ups</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Scheduled {DEFAULT_FOLLOW_UP_DELAY_DAYS} days after send. Replies
            cancel pending follow-ups automatically.
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Scheduled
              </dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-gray-900">
                {summary.scheduledCount}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Cancelled
              </dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-gray-900">
                {summary.cancelledCount}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Paused
              </dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-gray-900">
                {summary.pausedContactCount}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
