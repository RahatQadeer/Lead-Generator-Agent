"use client";

import { useState } from "react";
import { ContactRound } from "lucide-react";
import {
  OutreachStepPanel,
} from "@/components/ui/OutreachStepPanel";
import { StepActionButton } from "@/components/search/StepActionButton";
import { StepEmptyNotice, StepErrorAlert } from "@/components/search/StepFeedback";
import {
  DiscoveryProgressPanel,
  type DiscoveryProgressState,
} from "@/components/search/DiscoveryProgressPanel";
import {
  DiscoveryItemDetailModal,
  type DiscoveryDetailItem,
} from "@/components/search/DiscoveryItemDetailModal";
import { PreviewResultRow } from "@/components/search/PreviewResultRow";
import { socialProfileLinks } from "@/lib/contacts/social-links";
import { ENRICHMENT_STAGES } from "@/lib/ui/discovery-stages";
import { consumeEventStream } from "@/lib/ui/sse-client";
import { getNoLeadsEnrichedMessage } from "@/lib/ui/user-messages";
import type { ContactDetailsView } from "@/lib/pipeline/public-views";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { useRotatingStage } from "@/hooks/useRotatingStage";
import {
  isGatedStepActionDisabled,
  type OutreachStepControlProps,
} from "@/components/search/step-control";

interface EnrichLeadsPreviewProps extends OutreachStepControlProps {
  searchId: string;
  searchName: string;
}

interface EnrichLeadsResponse {
  success: boolean;
  provider?: string;
  leads?: ContactDetailsView[];
  meta?: {
    enrichedCount: number;
    skippedCount: number;
    discardedCount?: number;
    emailLeadCount?: number;
    linkedInLeadCount?: number;
    emailVerification?: {
      verifiedCount: number;
      likelyValidCount: number;
      invalidCount: number;
    };
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export function EnrichLeadsPreview({
  searchId,
  searchName,
  stepControl,
  onStepComplete,
}: EnrichLeadsPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnrichLeadsResponse | null>(null);
  const [progress, setProgress] = useState<DiscoveryProgressState | null>(null);
  const [detailItem, setDetailItem] = useState<DiscoveryDetailItem | null>(null);
  const elapsedSeconds = useElapsedSeconds(loading);
  const rotatingStage = useRotatingStage(ENRICHMENT_STAGES, loading);

  function handleEnrichPayload(data: EnrichLeadsResponse) {
    setResult(data);
    if (data.success && (data.meta?.enrichedCount ?? data.leads?.length ?? 0) > 0) {
      onStepComplete?.();
    }
  }

  async function runEnrichment() {
    setLoading(true);
    setResult(null);
    setProgress({});

    try {
      const res = await fetch("/api/leads/enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ searchId }),
      });

      // Fallback: server replied with JSON (e.g. an auth/validation error).
      if (!(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
        handleEnrichPayload((await res.json()) as EnrichLeadsResponse);
        return;
      }

      await consumeEventStream(res, {
        onProgress: (event) =>
          setProgress({
            current: event.current,
            total: event.total,
            itemLabel: event.label,
            stage: event.phase,
          }),
        onDone: (payload) => handleEnrichPayload(payload as EnrichLeadsResponse),
        onError: (error) =>
          setResult({
            success: false,
            error: {
              code: "STREAM_ERROR",
              message: error.message ?? "Enrichment failed",
              retryable: true,
            },
          }),
      });
    } catch {
      setResult({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Network error",
          retryable: true,
        },
      });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <OutreachStepPanel
      step={3}
      title="Add contact details"
      icon={ContactRound}
      stepControl={stepControl}
      action={
        <StepActionButton
          icon={ContactRound}
          label="Add contact details"
          loading={loading}
          loadingLabel="Finding contact details"
          onClick={runEnrichment}
          disabled={isGatedStepActionDisabled(loading, stepControl)}
        />
      }
    >
      {loading && (
        <DiscoveryProgressPanel
          title="Adding contact details"
          elapsedSeconds={elapsedSeconds}
          progress={{
            ...(progress ?? {}),
            stage: progress?.stage ?? rotatingStage,
          }}
          expectedSeconds={75}
        />
      )}

      {result && !result.success && result.error && (
        <StepErrorAlert
          error={result.error}
          retryable={result.error.retryable}
          onRetry={runEnrichment}
        />
      )}

      {result?.success && result.leads && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span>{result.meta?.enrichedCount ?? 0} leads kept</span>
            <span>{result.meta?.emailLeadCount ?? 0} email leads</span>
            <span>{result.meta?.linkedInLeadCount ?? 0} LinkedIn leads</span>
            {(result.meta?.emailVerification?.verifiedCount ?? 0) > 0 && (
              <span className="text-emerald-700">
                {result.meta?.emailVerification?.verifiedCount} emails verified
              </span>
            )}
            {(result.meta?.emailVerification?.likelyValidCount ?? 0) > 0 && (
              <span className="text-sky-700">
                {result.meta?.emailVerification?.likelyValidCount} likely valid
              </span>
            )}
            {(result.meta?.emailVerification?.invalidCount ?? 0) > 0 && (
              <span className="text-red-700">
                {result.meta?.emailVerification?.invalidCount} invalid emails
              </span>
            )}
            {(result.meta?.discardedCount ?? 0) > 0 && (
              <span className="text-gray-400">
                {result.meta?.discardedCount} discarded (no email or LinkedIn)
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Confidence % reflects how complete the lead is: verified email, LinkedIn profile, role
            fit, and company match.
          </p>

          {result.leads.length === 0 ? (
            <StepEmptyNotice
              message={getNoLeadsEnrichedMessage({
                discardedCount: result.meta?.discardedCount,
              })}
            />
          ) : (
            <ul className="space-y-2">
              {result.leads.map((lead) => (
                <PreviewResultRow
                  key={lead.id}
                  onClick={() => setDetailItem({ kind: "contact", data: lead })}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-sm font-medium text-gray-900">
                        {lead.fullName}
                      </p>
                      {lead.outreachChannel === "linkedin" && (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                          LinkedIn lead
                        </span>
                      )}
                      {lead.outreachChannel === "email" && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          Email lead
                        </span>
                      )}
                      {lead.outreachChannel === "phone" && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Phone lead
                        </span>
                      )}
                      {lead.outreachChannel === "social" && (
                        <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-medium text-fuchsia-700">
                          Social lead
                        </span>
                      )}
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                        {lead.confidenceScore}% confidence
                      </span>
                    </div>
                    <p className="mt-0.5 break-words text-xs text-violet-700">
                      {lead.title} · {lead.companyName}
                    </p>
                    <div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
                      {lead.email ? (
                        <p className="truncate">{lead.email}</p>
                      ) : (
                        <p className="text-gray-400">No verified email</p>
                      )}
                      {lead.personalLinkedIn ? (
                        <p className="truncate text-sky-700">LinkedIn profile found</p>
                      ) : (
                        <p className="text-gray-400">No LinkedIn profile</p>
                      )}
                      {lead.phone && <p className="truncate text-amber-700">{lead.phone}</p>}
                      {socialProfileLinks(lead.socialProfiles).length > 0 && (
                        <p className="truncate text-fuchsia-700">
                          {socialProfileLinks(lead.socialProfiles)
                            .map((profile) => profile.label)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                </PreviewResultRow>
              ))}
            </ul>
          )}
        </div>
      )}

      <DiscoveryItemDetailModal
        item={detailItem}
        onClose={() => setDetailItem(null)}
      />
    </OutreachStepPanel>
  );
}
