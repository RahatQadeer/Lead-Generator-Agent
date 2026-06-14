"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import {
  alertErrorClassName,
  alertSuccessClassName,
  btnSmPrimaryClassName,
} from "@/lib/ui/styles";
import type { ReplyTrackingProviderName } from "@/lib/reply-tracking/factory";
import type { ReplySummary } from "@/types/reply-tracking";

interface CheckRepliesPanelProps {
  summary: ReplySummary;
  replyProvider?: ReplyTrackingProviderName;
  autoCheck?: boolean;
}

export function CheckRepliesPanel({
  summary,
  replyProvider = "mock",
  autoCheck = false,
}: CheckRepliesPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoCheckedRef = useRef(false);

  async function handleCheckReplies() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/replies/detect", { method: "POST" });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Failed to check for replies.");
        return;
      }

      const { checkedCount, repliesFound } = data.meta;
      setMessage(
        checkedCount === 0
          ? "No sent emails awaiting reply check."
          : `Checked ${checkedCount} email${checkedCount === 1 ? "" : "s"} — ${repliesFound} repl${repliesFound === 1 ? "y" : "ies"} found.`
      );
      router.refresh();
    } catch {
      setError("Failed to connect to reply detection service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoCheck || autoCheckedRef.current) return;
    if (replyProvider === "mock" || summary.sentCount === 0) return;

    autoCheckedRef.current = true;
    void handleCheckReplies();
  }, [autoCheck, replyProvider, summary.sentCount]);

  if (summary.sentCount === 0) return null;

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Check replies</p>
          <p className="mt-1.5 text-sm text-gray-500">
            {summary.repliedCount} repl{summary.repliedCount === 1 ? "y" : "ies"}{" "}
            of {summary.sentCount} sent
            {summary.awaitingReplyCount > 0
              ? ` · ${summary.awaitingReplyCount} awaiting check`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCheckReplies}
          disabled={loading}
          className={`${btnSmPrimaryClassName} !min-h-[32px] shrink-0 px-3 py-1.5 text-xs`}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking replies…
            </>
          ) : (
            <>
              <MessageSquare className="h-4 w-4" />
              Check for replies
            </>
          )}
        </button>
      </div>
      {message && (
        <div className={`mt-3 ${alertSuccessClassName}`} role="status">
          {message}
        </div>
      )}
      {error && (
        <div className={`mt-3 ${alertErrorClassName}`} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
