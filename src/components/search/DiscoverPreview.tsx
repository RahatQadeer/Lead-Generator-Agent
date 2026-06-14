"use client";

import { useState } from "react";
import { Building2, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import {
  OutreachStepPanel,
  alertErrorClassName,
  btnSmPrimaryClassName,
} from "@/components/ui/OutreachStepPanel";
import { linkClassName, previewResultItemClassName } from "@/lib/ui/styles";
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
    duplicateCount: number;
    batchDuplicateCount: number;
    knownDuplicateCount: number;
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
    <OutreachStepPanel
      step={1}
      title="Find companies"
      description={`Search for companies that match "${searchName}"`}
      action={
        <button
          type="button"
          onClick={() => runDiscovery()}
          disabled={loading}
          className={btnSmPrimaryClassName}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Discovering…
            </>
          ) : (
            <>
              <Building2 className="h-4 w-4" />
              Find companies
            </>
          )}
        </button>
      }
    >
      {result && !result.success && result.error && (
        <div
          role="alert"
          className={`mt-4 flex items-start gap-2 ${alertErrorClassName}`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{result.error.message}</p>
            {result.error.code === "PLAN_RESTRICTED" && (
              <p className="mt-1 text-xs text-red-600/90">
                Apollo&apos;s organization search API requires a paid plan (free
                trials do not include it). Use the mock provider to continue
                building locally.
              </p>
            )}
            {result.error.retryable && (
              <button
                type="button"
                onClick={() => runDiscovery()}
                className={`mt-1 ${linkClassName}`}
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {result?.success && result.companies && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span>
              Provider:{" "}
              <strong className="text-gray-700">{result.provider}</strong>
            </span>
            <span>
              Page {result.pagination?.page} of {result.pagination?.totalPages}
            </span>
            <span>{result.pagination?.totalEntries} total matches</span>
            {(result.meta?.filteredCount ?? 0) > 0 && (
              <span className="text-amber-700">
                {result.meta?.filteredCount} filtered by criteria
              </span>
            )}
            {(result.meta?.duplicateCount ?? 0) > 0 && (
              <span className="text-violet-700">
                {result.meta?.duplicateCount} duplicates skipped
                {(result.meta?.knownDuplicateCount ?? 0) > 0 &&
                  ` (${result.meta?.knownDuplicateCount} already saved)`}
              </span>
            )}
            {(result.meta?.excludedCount ?? 0) > 0 && (
              <span className="text-red-700">
                {result.meta?.excludedCount} excluded by rules
              </span>
            )}
          </div>

          <ul className="space-y-2">
            {result.companies.map((company) => (
              <li key={company.id} className={previewResultItemClassName}>
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-gray-900">
                    {company.name}
                  </p>
                  <p className="break-words text-xs text-gray-500">
                    {company.domain ?? "—"}
                    {company.employeeCount
                      ? ` · ${company.employeeCount} employees`
                      : ""}
                    {company.country ? ` · ${company.country}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </li>
            ))}
          </ul>

          {result.pagination?.hasMore && (
            <button
              type="button"
              onClick={() => runDiscovery((result.pagination?.page ?? 1) + 1)}
              disabled={loading}
              className={`${linkClassName} text-xs disabled:opacity-50`}
            >
              Load next page →
            </button>
          )}
        </div>
      )}
    </OutreachStepPanel>
  );
}
