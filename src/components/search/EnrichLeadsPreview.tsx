"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  MapPin,
  Link2,
  Building2,
} from "lucide-react";
import {
  OutreachStepPanel,
  alertErrorClassName,
  btnSmPrimaryClassName,
} from "@/components/ui/OutreachStepPanel";
import { linkClassName, nestedCardClassName } from "@/lib/ui/styles";
import type { EnrichedLead } from "@/types/lead";

interface EnrichLeadsPreviewProps {
  searchId: string;
  searchName: string;
}

interface EnrichLeadsResponse {
  success: boolean;
  provider?: string;
  leads?: EnrichedLead[];
  meta?: {
    enrichedCount: number;
    skippedCount: number;
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
}: EnrichLeadsPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnrichLeadsResponse | null>(null);

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
    } catch {
      setResult({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Failed to connect to enrichment service.",
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
      description={`Fill in missing profile info for contacts from "${searchName}"`}
      action={
        <button
          type="button"
          onClick={runEnrichment}
          disabled={loading}
          className={btnSmPrimaryClassName}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enriching…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Add contact details
            </>
          )}
        </button>
      }
    >
      <p className="mt-0.5 text-xs text-gray-500">
        Adds LinkedIn, location, and other profile details
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
                Discover decision-makers on this search first, then enrich.
              </p>
            )}
            {result.error.retryable && (
              <button
                type="button"
                onClick={runEnrichment}
                className={`mt-1 ${linkClassName}`}
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {result?.success && result.leads && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span>
              Provider:{" "}
              <strong className="text-gray-700">{result.provider}</strong>
            </span>
            <span>{result.meta?.enrichedCount ?? 0} profiles enriched</span>
          </div>

          {result.leads.length === 0 ? (
            <p className="text-sm text-gray-500">No leads were enriched.</p>
          ) : (
            <ul className="space-y-2">
              {result.leads.map((lead) => (
                <li
                  key={lead.id}
                  className={`${nestedCardClassName} px-3 py-3`}
                >
                  <p className="break-words text-sm font-medium text-gray-900">
                    {lead.name}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-violet-700">
                    {lead.role}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1 break-words">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {lead.company}
                    </span>
                    {lead.location && (
                      <span className="inline-flex items-center gap-1 break-words">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {lead.location}
                      </span>
                    )}
                    {lead.linkedin && (
                      <a
                        href={lead.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${linkClassName} text-xs`}
                      >
                        <Link2 className="h-3 w-3" />
                        LinkedIn
                      </a>
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
