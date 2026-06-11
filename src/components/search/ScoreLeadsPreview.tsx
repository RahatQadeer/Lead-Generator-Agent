"use client";

import { useState } from "react";
import { Target, Loader2, AlertCircle } from "lucide-react";
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
    <div className="mt-4 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-orange-300">Lead scoring</p>
          <p className="text-xs text-slate-500">
            Score leads for &quot;{searchName}&quot; against search criteria
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Industry · Size · Location · Role · Technology → 1–10
          </p>
        </div>
        <button
          type="button"
          onClick={runScoring}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500/20 px-4 py-2 text-sm font-medium text-orange-300 transition-colors hover:bg-orange-500/30 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scoring…
            </>
          ) : (
            <>
              <Target className="h-4 w-4" />
              Score leads
            </>
          )}
        </button>
      </div>

      {result && !result.success && result.error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{result.error.message}</p>
            {result.error.code === "NO_CONTACTS" && (
              <p className="mt-1 text-xs text-red-300/90">
                Discover decision-makers on this search first.
              </p>
            )}
          </div>
        </div>
      )}

      {result?.success && result.results && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span>
              {result.meta?.scoredCount ?? 0} leads scored
            </span>
            <span className="text-orange-300">
              Avg score: {result.meta?.averageScore ?? 0}/10
            </span>
          </div>

          <ul className="space-y-2">
            {result.results.map((item) => (
              <li
                key={item.contactId}
                className="rounded-lg border border-white/5 bg-slate-900/50 px-3 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {item.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">{item.role}</p>
                  </div>
                  <LeadScoreBadge score={item.score} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(Object.keys(FACTOR_LABELS) as Array<keyof LeadScoreFactors>).map(
                    (key) => (
                      <span
                        key={key}
                        className="rounded-md bg-slate-800/80 px-2 py-0.5 text-xs text-slate-400"
                      >
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
    </div>
  );
}
