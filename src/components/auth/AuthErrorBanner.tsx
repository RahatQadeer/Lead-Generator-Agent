"use client";

import { AlertCircle } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  login_required: "Please sign in to access the dashboard.",
  session_expired: "Your session has expired. Please sign in again.",
  invalid_session: "Your session is invalid. Please sign in again.",
  access_denied: "Sign-in was cancelled. Please try again.",
  missing_auth_code: "Authentication failed — no authorization code received.",
  session_creation_failed: "Could not create your session. Please try again.",
  auth_failed: "Authentication failed. Please try again.",
};

const INFO_CODES = new Set(["login_required", "session_expired"]);

interface AuthErrorBannerProps {
  errorCode: string | null;
}

export function AuthErrorBanner({ errorCode }: AuthErrorBannerProps) {
  if (!errorCode) return null;

  const message =
    ERROR_MESSAGES[errorCode] ??
    decodeURIComponent(errorCode).replace(/\+/g, " ");

  const isInfo = INFO_CODES.has(errorCode);

  return (
    <div
      role="alert"
      className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        isInfo
          ? "border-amber-500/20 bg-amber-500/10 text-amber-100"
          : "border-red-500/20 bg-red-500/10 text-red-200"
      }`}
    >
      <AlertCircle
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          isInfo ? "text-amber-400" : "text-red-400"
        }`}
      />
      <p>{message}</p>
    </div>
  );
}
