"use client";

import { AlertCircle } from "lucide-react";
import { alertErrorClassName, linkClassName } from "@/lib/ui/styles";
import {
  getErrorHint,
  getUserFriendlyError,
  type ApiErrorLike,
} from "@/lib/ui/user-messages";

interface StepErrorAlertProps {
  error: ApiErrorLike;
  onRetry?: () => void;
  retryable?: boolean;
}

export function StepErrorAlert({ error, onRetry, retryable }: StepErrorAlertProps) {
  const hint = getErrorHint(error.code);

  return (
    <div
      role="alert"
      className={`mt-4 flex items-start gap-2 ${alertErrorClassName}`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-sm">{getUserFriendlyError(error)}</p>
        {hint && (
          <p className="mt-1 text-xs opacity-90">{hint}</p>
        )}
        {retryable && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={`mt-2 ${linkClassName} text-xs`}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

interface StepEmptyNoticeProps {
  message: string;
}

export function StepEmptyNotice({ message }: StepEmptyNoticeProps) {
  return (
    <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
      {message}
    </p>
  );
}
