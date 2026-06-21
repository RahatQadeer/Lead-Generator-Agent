import { Ban } from "lucide-react";

interface FollowUpStoppedBadgeProps {
  reason?: string | null;
}

export function FollowUpStoppedBadge({ reason }: FollowUpStoppedBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
      <Ban className="h-3 w-3 text-amber-600" strokeWidth={2} />
      Follow-ups stopped
      {reason ? ` · ${reason}` : ""}
    </span>
  );
}
