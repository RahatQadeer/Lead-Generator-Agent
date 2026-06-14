"use client";

import { useState } from "react";
import { Target, Loader2, AlertCircle } from "lucide-react";
import {
  OutreachStepPanel,
  alertErrorClassName,
  btnSmPrimaryClassName,
} from "@/components/ui/OutreachStepPanel";
import { nestedCardClassName, tagDefaultClassName } from "@/lib/ui/styles";
import { LeadScoreBadge } from "@/components/leads/LeadScoreBadge";
import type { LeadScoreFactors } from "@/types/lead-scoring";

interface ScoreLeadsPreviewProps {
  searchId: string;
  searchName: string;
}

interface ScoredLeadResponse {
  contactId: string;
  name: string;
  role: string;
  score: number;
  factors: LeadScoreFactors;
  scoredAt: string;
}

interface ScoreLeadsResponse {
  success: boolean;
  results?: ScoredLeadResponse[];
  meta?: {
    scoredCount: number;
    averageScore: number;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

const FACTOR_LABELS: Record<keyof LeadScoreFactors, string> = {
  industryMatch: "Industry",
  companySize: "Size",
  locationMatch: "Location",
  jobRoleMatch: "Role",
  technologyMatch: "Technology",
};

function formatFactor(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function ScoreLeadsPreview({
  searchId,
  searchName,
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
    } catch {
      setResult({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Failed to connect to lead scoring service.",
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
      description={`See which contacts are the best fit for "${searchName}"`}
      action={
        <button
          type="button"
          onClick={runScoring}
          disabled={loading}
          className={btnSmPrimaryClassName}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scoring…
            </>
          ) : (
            <>
              <Target className="h-4 w-4" />
              Rank leads
            </>
          )}
        </button>
      }
    >
      <p className="mt-0.5 text-xs text-gray-500">
        Ranks contacts from 1–10 based on how well they match your search
      </p>

      {result && !result.success && result.error && (
        <div
          role="alert"
          className={`mt-4 flex items-start gap-2 ${alertErrorClassName}`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{result.error.message}</p>
            {result.error.code === "NO_CONTACTS" && (
              <p className="mt-1 text-xs text-red-600/90">
                Discover decision-makers on this search first.
              </p>
            )}
          </div>
        </div>
      )}

      {result?.success && result.results && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span>{result.meta?.scoredCount ?? 0} leads scored</span>
            <span className="text-orange-700">
              Avg score: {result.meta?.averageScore ?? 0}/10
            </span>
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
                  </div>
                  <LeadScoreBadge score={item.score} />
                </div>
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
