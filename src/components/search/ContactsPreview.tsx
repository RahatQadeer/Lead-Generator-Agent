"use client";

import { useState } from "react";
import { Users, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import type { DiscoveredContact } from "@/types/contact";

interface ContactsPreviewProps {
  searchId: string;
  searchName: string;
  jobTitles: string[];
}

interface ContactsDiscoverResponse {
  success: boolean;
  provider?: string;
  contacts?: DiscoveredContact[];
  pagination?: {
    page: number;
    perPage: number;
    totalEntries: number;
    totalPages: number;
    hasMore: boolean;
  };
  meta?: {
    companyCount: number;
    jobTitles: string[];
    filteredCount: number;
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

export function ContactsPreview({
  searchId,
  searchName,
  jobTitles,
}: ContactsPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContactsDiscoverResponse | null>(null);

  async function runDiscovery(page = 1) {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/contacts/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId, page, perPage: 10 }),
      });

      const data = (await res.json()) as ContactsDiscoverResponse;
      setResult(data);
    } catch {
      setResult({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Failed to connect to contact discovery service.",
          retryable: true,
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-300">Decision-makers</p>
          <p className="text-xs text-slate-500">
            Find contacts at companies from &quot;{searchName}&quot;
          </p>
          {jobTitles.length > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              Targeting: {jobTitles.join(", ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => runDiscovery()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/30 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Finding contacts…
            </>
          ) : (
            <>
              <Users className="h-4 w-4" />
              Discover decision-makers
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
            {result.error.code === "NO_COMPANIES" && (
              <p className="mt-1 text-xs text-red-300/90">
                Run company discovery on this search first, then try again.
              </p>
            )}
            {result.error.code === "PLAN_RESTRICTED" && (
              <p className="mt-1 text-xs text-red-300/90">
                Apollo people search requires a paid plan. Use the mock provider
                for local development.
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

      {result?.success && result.contacts && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span>
              Provider: <strong className="text-slate-300">{result.provider}</strong>
            </span>
            <span>
              {result.meta?.companyCount ?? 0} companies searched
            </span>
            <span>
              Page {result.pagination?.page} of {result.pagination?.totalPages}
            </span>
            <span>
              {result.pagination?.totalEntries} contacts found
            </span>
            {(result.meta?.filteredCount ?? 0) > 0 && (
              <span className="text-amber-300">
                {result.meta?.filteredCount} filtered by title
              </span>
            )}
            {(result.meta?.duplicateCount ?? 0) > 0 && (
              <span className="text-violet-300">
                {result.meta?.duplicateCount} duplicates skipped
                {(result.meta?.knownDuplicateCount ?? 0) > 0 &&
                  ` (${result.meta?.knownDuplicateCount} already in pipeline)`}
              </span>
            )}
          </div>

          {result.contacts.length === 0 ? (
            <p className="text-sm text-slate-500">
              No decision-makers matched your job title filters.
            </p>
          ) : (
            <ul className="space-y-2">
              {result.contacts.map((contact) => (
                <li
                  key={`${contact.companyId}-${contact.id}`}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-900/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {contact.fullName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {contact.title} · {contact.companyName}
                    </p>
                    <p className="truncate text-xs text-slate-600">
                      {contact.email ?? "No email"}
                      {contact.companyDomain ? ` · ${contact.companyDomain}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                </li>
              ))}
            </ul>
          )}

          {result.pagination?.hasMore && (
            <button
              type="button"
              onClick={() => runDiscovery((result.pagination?.page ?? 1) + 1)}
              disabled={loading}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              Load next page →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
