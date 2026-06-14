"use client";

import { useState } from "react";
import { Users, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import {
  OutreachStepPanel,
  alertErrorClassName,
  btnSmPrimaryClassName,
} from "@/components/ui/OutreachStepPanel";
import { linkClassName, previewResultItemClassName } from "@/lib/ui/styles";
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
    <OutreachStepPanel
      step={2}
      title="Find people"
      description={`Find the right people at companies from "${searchName}"`}
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
              Finding contacts…
            </>
          ) : (
            <>
              <Users className="h-4 w-4" />
              Find people
            </>
          )}
        </button>
      }
    >
      {jobTitles.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Looking for: {jobTitles.join(", ")}
        </p>
      )}

      {result && !result.success && result.error && (
        <div
          role="alert"
          className={`mt-4 flex items-start gap-2 ${alertErrorClassName}`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{result.error.message}</p>
            {result.error.code === "NO_COMPANIES" && (
              <p className="mt-1 text-xs text-red-600/90">
                Find companies first (Step 1), then try again.
              </p>
            )}
            {result.error.code === "PLAN_RESTRICTED" && (
              <p className="mt-1 text-xs text-red-600/90">
                Apollo people search requires a paid plan. Use the mock provider
                for local development.
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

      {result?.success && result.contacts && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span>
              Provider:{" "}
              <strong className="text-gray-700">{result.provider}</strong>
            </span>
            <span>{result.meta?.companyCount ?? 0} companies searched</span>
            <span>
              Page {result.pagination?.page} of {result.pagination?.totalPages}
            </span>
            <span>{result.pagination?.totalEntries} contacts found</span>
            {(result.meta?.filteredCount ?? 0) > 0 && (
              <span className="text-amber-700">
                {result.meta?.filteredCount} filtered by title
              </span>
            )}
            {(result.meta?.duplicateCount ?? 0) > 0 && (
              <span className="text-violet-700">
                {result.meta?.duplicateCount} duplicates skipped
                {(result.meta?.knownDuplicateCount ?? 0) > 0 &&
                  ` (${result.meta?.knownDuplicateCount} already saved)`}
              </span>
            )}
          </div>

          {result.contacts.length === 0 ? (
            <p className="text-sm text-gray-500">
              No decision-makers matched your job title filters.
            </p>
          ) : (
            <ul className="space-y-2">
              {result.contacts.map((contact) => (
                <li
                  key={`${contact.companyId}-${contact.id}`}
                  className={previewResultItemClassName}
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-gray-900">
                      {contact.fullName}
                    </p>
                    <p className="break-words text-xs text-gray-500">
                      {contact.title} · {contact.companyName}
                    </p>
                    <p className="break-all text-xs text-gray-500">
                      {contact.email ?? "No email"}
                      {contact.companyDomain ? ` · ${contact.companyDomain}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                </li>
              ))}
            </ul>
          )}

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
