"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { getSendingProviderLabel } from "@/lib/email-sending/factory";
import {
  alertErrorClassName,
  alertSuccessClassName,
  btnSmPrimaryClassName,
  textSecondaryClassName,
} from "@/lib/ui/styles";
import type { CampaignSummary } from "@/types/email-campaign";
import type { EmailSendingProviderName } from "@/types/email-sending";
import { getApiErrorMessage } from "@/lib/ui/user-messages";

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
        setError(getApiErrorMessage(data.error, "Failed to send campaign."));
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
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">Send campaign</p>
        <p className={`mt-1.5 ${textSecondaryClassName}`}>
          No drafts ready. Generate outreach from the Leads page, then launch a
          batch send here.
        </p>
        {summary.sentCount > 0 && (
          <p className={`mt-2 text-xs text-gray-500`}>
            {summary.sentCount} email{summary.sentCount === 1 ? "" : "s"} already
            sent across {summary.campaignCount} campaign
            {summary.campaignCount === 1 ? "" : "s"}.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Send campaign</p>
          <p className={`mt-1.5 ${textSecondaryClassName}`}>
            {summary.draftCount} draft{summary.draftCount === 1 ? "" : "s"} queued
            {" · "}
            via {getSendingProviderLabel(sendingProvider)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSendCampaign}
          disabled={loading}
          className={`${btnSmPrimaryClassName} !min-h-[32px] shrink-0 px-3 py-1.5 text-xs`}
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
