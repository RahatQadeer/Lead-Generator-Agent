import Link from "next/link";
import { MessageSquare } from "lucide-react";
import type { RecentReplyMetric } from "@/types/dashboard";

function formatReplyDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface EmailReplyItemProps {
  reply: RecentReplyMetric;
}

export function EmailReplyItem({ reply }: EmailReplyItemProps) {
  return (
    <Link
      href="/emails"
      className="group flex gap-2.5 rounded-xl border border-gray-100 border-l-[3px] border-l-emerald-400 bg-white py-2.5 pl-2.5 pr-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-[border-color,box-shadow] duration-200 hover:border-gray-200 hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
        <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-snug text-gray-900 group-hover:text-violet-900">
          {reply.leadName}
        </p>
        <p className="mt-0.5 truncate text-xs leading-snug text-gray-500">
          {reply.subject}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium tabular-nums text-gray-400">
            {formatReplyDate(reply.repliedAt)}
          </span>
          <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            Reply
          </span>
        </div>
      </div>
    </Link>
  );
}
