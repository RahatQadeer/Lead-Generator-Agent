"use client";

import { useState } from "react";
import { Building2, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import type { DiscoveredCompany } from "@/types/company";

interface DiscoverPreviewProps {
  searchId: string;
  searchName: string;
}

interface DiscoverResponse {
  success: boolean;
  provider?: string;
  companies?: DiscoveredCompany[];
  pagination?: {
    page: number;
    perPage: number;
    totalEntries: number;
    totalPages: number;
    hasMore: boolean;
  };
  meta?: {
    filteredCount: number;
    excludedCount: number;
    attempts: number;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export function DiscoverPreview({ searchId, searchName }: DiscoverPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiscoverResponse | null>(null);

  async function runDiscovery(page = 1) {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/companies/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId, page, perPage: 10 }),
      });

      const data = (await res.json()) as DiscoverResponse;
      setResult(data);
    } catch {
      setResult({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Failed to connect to discovery service.",
          retryable: true,
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-300">Company discovery</p>
          <p className="text-xs text-slate-500">
            Preview companies matching &quot;{searchName}&quot;
          </p>
        </div>
        <button
          type="button"
          onClick={() => runDiscovery()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-500/30 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Discovering…
            </>
          ) : (
            <>
              <Building2 className="h-4 w-4" />
              Discover companies
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
            {result.error.code === "PLAN_RESTRICTED" && (
              <p className="mt-1 text-xs text-red-300/90">
                Apollo&apos;s organization search API requires a paid plan (free
                trials do not include it). Use the mock provider to continue
                building locally.
              </p>
            )}
            {result.error.retryable && (
              <button
                type="button"
                onClick={() => runDiscovery()}
                className="mt-1 text-xs text-red-300 underline hover:text-white"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {result?.success && result.companies && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span>
              Provider: <strong className="text-slate-300">{result.provider}</strong>
            </span>
            <span>
              Page {result.pagination?.page} of {result.pagination?.totalPages}
            </span>
            <span>
              {result.pagination?.totalEntries} total matches
            </span>
            {(result.meta?.filteredCount ?? 0) > 0 && (
              <span className="text-amber-300">
                {result.meta?.filteredCount} filtered by criteria
              </span>
            )}
            {(result.meta?.excludedCount ?? 0) > 0 && (
              <span className="text-red-300">
                {result.meta?.excludedCount} excluded by rules
              </span>
            )}
          </div>

          <ul className="space-y-2">
            {result.companies.map((company) => (
              <li
                key={company.id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-900/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {company.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {company.domain ?? "—"}
                    {company.employeeCount
                      ? ` · ${company.employeeCount} employees`
                      : ""}
                    {company.country ? ` · ${company.country}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
              </li>
            ))}
          </ul>

          {result.pagination?.hasMore && (
            <button
              type="button"
              onClick={() => runDiscovery((result.pagination?.page ?? 1) + 1)}
              disabled={loading}
              className="text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
            >
              Load next page →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
