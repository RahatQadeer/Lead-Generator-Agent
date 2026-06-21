"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { getSendingProviderLabel } from "@/lib/email-sending/factory";
import type { CampaignSummary } from "@/types/email-campaign";
import type { EmailSendingProviderName } from "@/types/email-sending";

interface SendCampaignPanelProps {
  summary: CampaignSummary;
  sendingProvider: EmailSendingProviderName;
}

export function SendCampaignPanel({
  summary,
  sendingProvider,
}: SendCampaignPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCampaign() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/emails/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Failed to send campaign.");
        return;
      }

      const { sentCount, failedCount, status } = data.meta;
      setMessage(
        `Campaign ${status}: ${sentCount} sent` +
          (failedCount > 0 ? `, ${failedCount} failed` : "") +
          "."
      );
      router.refresh();
    } catch {
      setError("Failed to connect to campaign sending service.");
    } finally {
      setLoading(false);
    }
  }

  if (summary.draftCount === 0) {
    return (
      <div className="mb-6 rounded-xl border border-white/10 bg-slate-900/50 p-4">
        <p className="text-sm text-slate-400">
          No draft emails ready. Generate outreach from the Leads page, then send
          a campaign from here.
        </p>
        {summary.sentCount > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            {summary.sentCount} email{summary.sentCount === 1 ? "" : "s"} already
            sent across {summary.campaignCount} campaign
            {summary.campaignCount === 1 ? "" : "s"}.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">Ready to launch</p>
          <p className="mt-1 text-xs text-slate-400">
            {summary.draftCount} draft{summary.draftCount === 1 ? "" : "s"} queued
            {" · "}
            via {getSendingProviderLabel(sendingProvider)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSendCampaign}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending campaign…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send all drafts
            </>
          )}
        </button>
      </div>
      {message && <p className="mt-3 text-xs text-emerald-300">{message}</p>}
      {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
