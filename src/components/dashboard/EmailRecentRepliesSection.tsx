"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { EmailReplyItem } from "@/components/dashboard/EmailReplyItem";
import type { RecentReplyMetric } from "@/types/dashboard";

const PREVIEW_COUNT = 3;

interface EmailRecentRepliesSectionProps {
  replies: RecentReplyMetric[];
  previewCount?: number;
}

export function EmailRecentRepliesSection({
  replies,
  previewCount = PREVIEW_COUNT,
}: EmailRecentRepliesSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const hasMore = replies.length > previewCount;
  const visible =
    expanded || !hasMore ? replies : replies.slice(0, previewCount);
  const hiddenCount = Math.max(0, replies.length - previewCount);

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Recent replies
      </h3>
      <ul className="mt-3 space-y-2">
        {visible.map((reply) => (
          <li key={reply.id}>
            <EmailReplyItem reply={reply} />
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-100 py-2.5 text-sm font-medium text-gray-600 transition-colors duration-200 hover:bg-gray-50 hover:text-gray-900"
        >
          {expanded ? (
            <>
              Show less
              <ChevronDown className="h-4 w-4 rotate-180 transition-transform duration-200" />
            </>
          ) : (
            <>
              Show {hiddenCount} more
              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
