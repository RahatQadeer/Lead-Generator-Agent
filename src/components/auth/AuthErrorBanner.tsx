"use client";

import { AlertCircle } from "lucide-react";
import { alertErrorClassName, alertWarningClassName } from "@/lib/ui/styles";

const ERROR_MESSAGES: Record<string, string> = {
  login_required: "Please sign in to access this page.",
  session_expired: "Your session has expired. Please sign in again.",
  invalid_session: "Your session is invalid. Please sign in again.",
  access_denied: "Sign-in was cancelled. Please try again.",
  missing_auth_code: "Authentication failed — no authorization code received.",
  session_creation_failed: "Could not create your session. Please try again.",
  auth_failed: "Authentication failed. Please try again.",
  pkce_error:
    "Sign-in session expired. Please try logging in again from the same browser.",
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
      className={`mb-6 flex items-start gap-3 ${
        isInfo ? alertWarningClassName : alertErrorClassName
      }`}
    >
      <AlertCircle
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          isInfo ? "text-amber-600" : "text-red-600"
        }`}
      />
      <p>{message}</p>
    </div>
  );
}
