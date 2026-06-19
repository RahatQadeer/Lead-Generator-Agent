"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import {
  OutreachStepPanel,
} from "@/components/ui/OutreachStepPanel";
import { StepActionButton } from "@/components/search/StepActionButton";
import { StepErrorAlert } from "@/components/search/StepFeedback";
import { previewResultItemClassName } from "@/lib/ui/styles";
import { EmailVerificationBadge } from "@/components/leads/EmailVerificationBadge";
import type { EmailVerificationView } from "@/lib/pipeline/public-views";
import {
  isGatedStepActionDisabled,
  type OutreachStepControlProps,
} from "@/components/search/step-control";

interface VerifyEmailsPreviewProps extends OutreachStepControlProps {
  searchId: string;
  searchName: string;
}

interface VerifyEmailsResponse {
  success: boolean;
  provider?: string;
  results?: EmailVerificationView[];
  meta?: {
    validCount: number;
    invalidCount: number;
    riskyCount: number;
    skippedCount: number;
    linkedInLeadCount?: number;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export function VerifyEmailsPreview({
  searchId,
  stepControl,
  onStepComplete,
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
      if (data.success) {
        onStepComplete?.();
      }
    } catch {
      setResult({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Network error",
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
      icon={MailCheck}
      stepControl={stepControl}
      action={
        <StepActionButton
          icon={MailCheck}
          label="Verify emails"
          loading={loading}
          loadingLabel="Verifying emails"
          onClick={runVerification}
          disabled={isGatedStepActionDisabled(loading, stepControl)}
        />
      }
    >
      {result && !result.success && result.error && (
        <StepErrorAlert
          error={result.error}
          retryable={result.error.retryable}
          onRetry={runVerification}
        />
      )}

      {result?.success && result.results && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="text-emerald-700">
              {result.meta?.validCount ?? 0} verified
            </span>
            <span className="text-sky-700">
              {result.meta?.riskyCount ?? 0} likely valid
            </span>
            <span className="text-red-700">
              {result.meta?.invalidCount ?? 0} invalid
            </span>
            {(result.meta?.skippedCount ?? 0) > 0 && (
              <span>{result.meta?.skippedCount} no email</span>
            )}
            {(result.meta?.linkedInLeadCount ?? 0) > 0 && (
              <span className="text-sky-700">
                {result.meta?.linkedInLeadCount} LinkedIn leads (skipped)
              </span>
            )}
          </div>

          <ul className="space-y-2">
            {result.results.map((item) => (
              <li key={item.contactId} className={previewResultItemClassName}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {item.contactName}
                  </p>
                  {item.email && (
                    <>
                      <p className="break-all text-xs text-gray-600">{item.email}</p>
                      <p className="break-words text-xs text-gray-500">{item.message}</p>
                    </>
                  )}
                </div>
                {item.email && (
                  <EmailVerificationBadge displayStatus={item.displayStatus} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </OutreachStepPanel>
  );
}
