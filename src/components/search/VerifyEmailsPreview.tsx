"use client";

import { useState } from "react";
import { MailCheck, Loader2, AlertCircle } from "lucide-react";
import {
  OutreachStepPanel,
  alertErrorClassName,
  btnSmPrimaryClassName,
} from "@/components/ui/OutreachStepPanel";
import { previewResultItemClassName } from "@/lib/ui/styles";
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
    <OutreachStepPanel
      step={4}
      title="Check emails"
      description="Make sure contact emails are valid before you reach out"
      action={
        <button
          type="button"
          onClick={runVerification}
          disabled={loading}
          className={btnSmPrimaryClassName}
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
      }
    >
      <p className="mt-0.5 text-xs text-gray-500">
        Flags invalid or risky email addresses
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
            {result.error.retryable && (
              <button
                type="button"
                onClick={runVerification}
                className="mt-1 text-xs font-medium text-red-700 underline hover:text-red-800"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {result?.success && result.results && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span>
              Provider:{" "}
              <strong className="text-gray-700">{result.provider}</strong>
            </span>
            <span className="text-emerald-700">
              {result.meta?.validCount ?? 0} valid
            </span>
            <span className="text-red-700">
              {result.meta?.invalidCount ?? 0} invalid
            </span>
            {(result.meta?.riskyCount ?? 0) > 0 && (
              <span className="text-amber-700">
                {result.meta?.riskyCount} risky
              </span>
            )}
            {(result.meta?.skippedCount ?? 0) > 0 && (
              <span>{result.meta?.skippedCount} no email</span>
            )}
          </div>

          <ul className="space-y-2">
            {result.results.map((item) => (
              <li key={item.contactId} className={previewResultItemClassName}>
                <div className="min-w-0">
                  <p className="break-all text-sm text-gray-900">
                    {item.email ?? "No email"}
                  </p>
                  {item.message && (
                    <p className="break-words text-xs text-gray-500">
                      {item.message}
                    </p>
                  )}
                </div>
                <EmailVerificationBadge status={item.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </OutreachStepPanel>
  );
}
