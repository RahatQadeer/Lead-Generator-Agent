import { DEFAULT_FOLLOW_UP_DELAY_DAYS } from "@/lib/follow-ups/constants";
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
    <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <p className="text-sm font-medium text-white">Follow-up queue</p>
      <p className="mt-1 text-xs text-slate-400">
        New follow-ups are scheduled {DEFAULT_FOLLOW_UP_DELAY_DAYS} days after
        send. Replies automatically cancel pending follow-ups.
      </p>
      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">Scheduled</dt>
          <dd className="mt-0.5 text-sm text-white">{summary.scheduledCount}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Cancelled (replied)</dt>
          <dd className="mt-0.5 text-sm text-white">{summary.cancelledCount}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Contacts paused</dt>
          <dd className="mt-0.5 text-sm text-white">
            {summary.pausedContactCount}
          </dd>
        </div>
      </dl>
    </div>
  );
}
