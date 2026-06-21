"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  OutreachStepPanel,
} from "@/components/ui/OutreachStepPanel";
import { StepActionButton } from "@/components/search/StepActionButton";
import { StepErrorAlert } from "@/components/search/StepFeedback";
import { nestedCardClassName, tagDefaultClassName } from "@/lib/ui/styles";
import { IntentSignalsBadge } from "@/components/leads/IntentSignalsBadge";
import type { LeadScoreFactors } from "@/types/lead-scoring";
import type { IntentSignal } from "@/types/intent-signals";

import type { LeadQualityView } from "@/lib/pipeline/public-views";
import {
  isGatedStepActionDisabled,
  type OutreachStepControlProps,
} from "@/components/search/step-control";

interface ScoreLeadsPreviewProps extends OutreachStepControlProps {
  searchId: string;
  searchName: string;
}

interface ScoredLeadResponse {
  contactId: string;
  name: string;
  role: string;
  score: number;
  overallScore: number;
  companyScore: number;
  personScore: number;
  contactScore: number;
  qualityCategory: string;
  confidenceScore: number;
  factors: LeadScoreFactors;
  scoredAt: string;
  intentScore?: number | null;
  intentSignals?: IntentSignal[] | null;
  lead?: LeadQualityView | null;
}

interface ScoreLeadsResponse {
  success: boolean;
  results?: ScoredLeadResponse[];
  meta?: {
    scoredCount: number;
    averageScore: number;
    intentLeadCount?: number;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

const FACTOR_LABELS: Record<keyof LeadScoreFactors, string> = {
  industryMatch: "Industry",
  companyTypeVerified: "Company type",
  companySize: "Size",
  locationMatch: "Location",
  jobRoleMatch: "Role",
  technologyMatch: "Technology",
};

const CATEGORY_STYLES: Record<string, string> = {
  excellent: "bg-emerald-50 text-emerald-800 border-emerald-200",
  good: "bg-sky-50 text-sky-800 border-sky-200",
  average: "bg-amber-50 text-amber-800 border-amber-200",
  reject: "bg-gray-100 text-gray-600 border-gray-200",
};

function formatFactor(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function ScoreLeadsPreview({
  searchId,
  searchName,
  stepControl,
  onStepComplete,
}: ScoreLeadsPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreLeadsResponse | null>(null);

  async function runScoring() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/leads/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId }),
      });

      const data = (await res.json()) as ScoreLeadsResponse;
      setResult(data);
      if (data.success && (data.meta?.scoredCount ?? data.results?.length ?? 0) > 0) {
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
      step={5}
      title="Rank your leads"
      icon={BarChart3}
      stepControl={stepControl}
      action={
        <StepActionButton
          icon={BarChart3}
          label="Rank leads"
          loading={loading}
          loadingLabel="Ranking leads"
          onClick={runScoring}
          disabled={isGatedStepActionDisabled(loading, stepControl)}
        />
      }
    >
      {result && !result.success && result.error && (
        <StepErrorAlert error={result.error} />
      )}

      {result?.success && result.results && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span>{result.meta?.scoredCount ?? 0} leads scored</span>
            <span className="text-orange-700">
              Avg overall: {result.meta?.averageScore ?? 0}/100
            </span>
            {(result.meta?.intentLeadCount ?? 0) > 0 && (
              <span className="text-emerald-700">
                {result.meta?.intentLeadCount} with buying signals
              </span>
            )}
          </div>

          <ul className="space-y-2">
            {result.results.map((item) => (
              <li
                key={item.contactId}
                className={`${nestedCardClassName} px-3 py-3`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-gray-900">
                      {item.name}
                    </p>
                    <p className="break-words text-xs text-gray-500">
                      {item.role}
                    </p>
                    <div className="mt-1">
                      <IntentSignalsBadge
                        score={item.intentScore ?? null}
                        signals={item.intentSignals}
                        compact
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        CATEGORY_STYLES[item.qualityCategory] ?? CATEGORY_STYLES.average
                      }`}
                    >
                      {item.overallScore}/100 · {categoryLabel(item.qualityCategory)}
                    </span>
                    <span className="text-[10px] font-medium text-violet-700">
                      Co {item.companyScore} · Person {item.personScore} · Contact{" "}
                      {item.contactScore}
                    </span>
                  </div>
                </div>
                {item.lead?.contact.email && (
                  <p className="mt-1 text-xs text-gray-600">
                    {item.lead.contact.email}
                    {item.lead.contact.verificationStatus
                      ? ` · ${item.lead.contact.verificationStatus}`
                      : ""}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {(Object.keys(FACTOR_LABELS) as Array<keyof LeadScoreFactors>).map(
                    (key) => (
                      <span key={key} className={tagDefaultClassName}>
                        {FACTOR_LABELS[key]}: {formatFactor(item.factors[key])}
                      </span>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </OutreachStepPanel>
  );
}
