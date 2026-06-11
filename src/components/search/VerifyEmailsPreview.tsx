"use client";

import { useState } from "react";
import { MailCheck, Loader2, AlertCircle } from "lucide-react";
import { EmailVerificationBadge } from "@/components/leads/EmailVerificationBadge";
import type { VerifiedEmail } from "@/types/email-verification";

interface VerifyEmailsPreviewProps {
  searchId: string;
  searchName: string;
}

interface VerifyEmailsResponse {
  success: boolean;
  provider?: string;
  results?: VerifiedEmail[];
  meta?: {
    validCount: number;
    invalidCount: number;
    riskyCount: number;
    skippedCount: number;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export function VerifyEmailsPreview({
  searchId,
  searchName,
}: VerifyEmailsPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyEmailsResponse | null>(null);

  async function runVerification() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/leads/verify-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId }),
      });

      const data = (await res.json()) as VerifyEmailsResponse;
      setResult(data);
    } catch {
      setResult({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Failed to connect to email verification service.",
          retryable: true,
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-300">Email verification</p>
          <p className="text-xs text-slate-500">
            Verify contact emails for &quot;{searchName}&quot;
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Syntax → domain → verification API
          </p>
        </div>
        <button
          type="button"
          onClick={runVerification}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              <MailCheck className="h-4 w-4" />
              Verify emails
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
            {result.error.retryable && (
              <button
                type="button"
                onClick={runVerification}
                className="mt-1 text-xs text-red-300 underline hover:text-white"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {result?.success && result.results && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span>
              Provider: <strong className="text-slate-300">{result.provider}</strong>
            </span>
            <span className="text-emerald-300">
              {result.meta?.validCount ?? 0} valid
            </span>
            <span className="text-red-300">
              {result.meta?.invalidCount ?? 0} invalid
            </span>
            {(result.meta?.riskyCount ?? 0) > 0 && (
              <span className="text-amber-300">
                {result.meta?.riskyCount} risky
              </span>
            )}
            {(result.meta?.skippedCount ?? 0) > 0 && (
              <span>{result.meta?.skippedCount} no email</span>
            )}
          </div>

          <ul className="space-y-2">
            {result.results.map((item) => (
              <li
                key={item.contactId}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-slate-900/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">
                    {item.email ?? "No email"}
                  </p>
                  {item.message && (
                    <p className="truncate text-xs text-slate-500">{item.message}</p>
                  )}
                </div>
                <EmailVerificationBadge status={item.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
