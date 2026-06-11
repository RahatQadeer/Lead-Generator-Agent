"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import type { ReplySummary } from "@/types/reply-tracking";

interface CheckRepliesPanelProps {
  summary: ReplySummary;
}

export function CheckRepliesPanel({ summary }: CheckRepliesPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (summary.sentCount === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">Reply tracking</p>
          <p className="mt-1 text-xs text-slate-400">
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
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500/20 px-4 py-2 text-sm font-medium text-sky-200 transition-colors hover:bg-sky-500/30 disabled:opacity-50"
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
      {message && <p className="mt-3 text-xs text-sky-300">{message}</p>}
      {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
