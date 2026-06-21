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
    <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-violet-300">Lead enrichment</p>
          <p className="text-xs text-slate-500">
            Enrich profiles for contacts from &quot;{searchName}&quot;
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Name · Role · Company · LinkedIn · Location
          </p>
        </div>
        <button
          type="button"
          onClick={runEnrichment}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-300 transition-colors hover:bg-violet-500/30 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enriching…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Enrich lead profiles
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
                Discover decision-makers on this search first, then enrich.
              </p>
            )}
            {result.error.retryable && (
              <button
                type="button"
                onClick={runEnrichment}
                className="mt-1 text-xs text-red-300 underline hover:text-white"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {result?.success && result.leads && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span>
              Provider: <strong className="text-slate-300">{result.provider}</strong>
            </span>
            <span>
              {result.meta?.enrichedCount ?? 0} profiles enriched
            </span>
          </div>

          {result.leads.length === 0 ? (
            <p className="text-sm text-slate-500">No leads were enriched.</p>
          ) : (
            <ul className="space-y-2">
              {result.leads.map((lead) => (
                <li
                  key={lead.id}
                  className="rounded-lg border border-white/5 bg-slate-900/50 px-3 py-3"
                >
                  <p className="text-sm font-medium text-white">{lead.name}</p>
                  <p className="mt-0.5 text-xs text-violet-300">{lead.role}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {lead.company}
                    </span>
                    {lead.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {lead.location}
                      </span>
                    )}
                    {lead.linkedin && (
                      <a
                        href={lead.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
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
    </div>
  );
}
