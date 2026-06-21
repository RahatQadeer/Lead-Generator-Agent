import { Ban } from "lucide-react";

interface FollowUpStoppedBadgeProps {
  reason?: string | null;
}

export function FollowUpStoppedBadge({ reason }: FollowUpStoppedBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
      <Ban className="h-3 w-3" />
      Follow-ups stopped
      {reason ? ` · ${reason}` : ""}
    </span>
  );
}
