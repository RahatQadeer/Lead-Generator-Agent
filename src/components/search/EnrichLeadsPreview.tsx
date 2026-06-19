"use client";

import { useState } from "react";
import { ContactRound, MapPin, Link2, Mail } from "lucide-react";
import {
  OutreachStepPanel,
} from "@/components/ui/OutreachStepPanel";
import { StepActionButton } from "@/components/search/StepActionButton";
import { StepEmptyNotice, StepErrorAlert } from "@/components/search/StepFeedback";
import { DiscoveryProgressPanel } from "@/components/search/DiscoveryProgressPanel";
import { linkClassName, nestedCardClassName } from "@/lib/ui/styles";
import { ENRICHMENT_STAGES } from "@/lib/ui/discovery-stages";
import { getNoLeadsEnrichedMessage } from "@/lib/ui/user-messages";
import type { ContactDetailsView } from "@/lib/pipeline/public-views";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { useRotatingStage } from "@/hooks/useRotatingStage";
import {
  isGatedStepActionDisabled,
  type OutreachStepControlProps,
} from "@/components/search/step-control";

function linkedInSourceLabel(source: ContactDetailsView["linkedInSource"]): string {
  if (source === "website") return "From company website";
  if (source === "pdl") return "People Data Labs";
  if (source === "public_profile") return "Google/Bing search";
  return "";
}

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
  const elapsedSeconds = useElapsedSeconds(loading);
  const rotatingStage = useRotatingStage(ENRICHMENT_STAGES, loading);

  async function runEnrichment() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/leads/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId }),
      });

      const data = (await res.json()) as EnrichLeadsResponse;
      setResult(data);
      if (data.success && (data.meta?.enrichedCount ?? data.leads?.length ?? 0) > 0) {
        onStepComplete?.();
      }
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
          progress={{ stage: rotatingStage }}
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

          {result.leads.length === 0 ? (
            <StepEmptyNotice
              message={getNoLeadsEnrichedMessage({
                discardedCount: result.meta?.discardedCount,
              })}
            />
          ) : (
            <ul className="space-y-2">
              {result.leads.map((lead) => (
                <li
                  key={lead.id}
                  className={`${nestedCardClassName} px-3 py-3`}
                >
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
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                      {lead.confidenceScore}% confidence
                    </span>
                  </div>
                  <p className="mt-0.5 break-words text-xs text-violet-700">
                    {lead.title} · {lead.companyName}
                  </p>
                  <div className="mt-2 space-y-1.5 text-xs text-gray-600">
                    {lead.email ? (
                      <p className="inline-flex items-start gap-1.5 break-all">
                        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span>
                          <span className="font-medium text-gray-900">{lead.email}</span>
                          <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            Verified
                          </span>
                        </span>
                      </p>
                    ) : (
                      <p className="text-gray-400">No verified email found</p>
                    )}
                    {lead.personalLinkedIn ? (
                      <div className="flex flex-col gap-0.5">
                        <a
                          href={lead.personalLinkedIn}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${linkClassName} inline-flex items-center gap-1.5 break-all`}
                        >
                          <Link2 className="h-3.5 w-3.5 shrink-0 text-[#0A66C2]" />
                          {lead.personalLinkedIn.replace(/^https?:\/\/(www\.)?/, "")}
                        </a>
                        {lead.linkedInSource && (
                          <span className="pl-5 text-[10px] text-gray-500">
                            {linkedInSourceLabel(lead.linkedInSource)}
                            {lead.linkedInSource === "public_profile"
                              ? " · Google/Bing search"
                              : ""}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-400">No LinkedIn profile found</p>
                    )}
                    {lead.outreachChannel === "linkedin" && lead.personalLinkedIn && (
                      <p className="text-sky-700">Outreach via LinkedIn</p>
                    )}
                    {lead.location && (
                      <p className="inline-flex items-center gap-1 break-words text-gray-500">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {lead.location}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </OutreachStepPanel>
  );
}
