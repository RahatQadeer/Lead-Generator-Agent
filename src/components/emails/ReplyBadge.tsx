import { MessageSquare } from "lucide-react";
import type { ReplyStatus } from "@/types/email-generation";

interface ReplyBadgeProps {
  replyStatus: ReplyStatus;
  repliedAt?: string | null;
}

export function ReplyBadge({ replyStatus, repliedAt }: ReplyBadgeProps) {
  if (replyStatus !== "replied") return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
      <MessageSquare className="h-3 w-3 text-sky-600" strokeWidth={2} />
      Replied
      {repliedAt
        ? ` · ${new Date(repliedAt).toLocaleDateString()}`
        : ""}
    </span>
  );
}
