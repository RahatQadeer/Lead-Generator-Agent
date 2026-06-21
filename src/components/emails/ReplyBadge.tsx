import { MessageSquare } from "lucide-react";
import type { ReplyStatus } from "@/types/email-generation";

interface ReplyBadgeProps {
  replyStatus: ReplyStatus;
  repliedAt?: string | null;
}

export function ReplyBadge({ replyStatus, repliedAt }: ReplyBadgeProps) {
  if (replyStatus !== "replied") return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">
      <MessageSquare className="h-3 w-3" />
      Replied
      {repliedAt
        ? ` · ${new Date(repliedAt).toLocaleDateString()}`
        : ""}
    </span>
  );
}
