"use client";

import type { EmailDisplayStatus, EmailVerificationStatus } from "@/types/email-verification";
import { emailDisplayLabel } from "@/lib/email-verification/display-status";

const DISPLAY_STYLES: Record<
  EmailDisplayStatus,
  { label: string; className: string }
> = {
  verified: {
    label: "Verified",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  likely_valid: {
    label: "Likely Valid",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  risky: {
    label: "Risky",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  not_found: {
    label: "Not Found",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  invalid: {
    label: "Invalid",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  unknown: {
    label: "Unknown",
    className: "border-gray-200 bg-gray-50 text-gray-600",
  },
};

const STATUS_STYLES: Record<
  EmailVerificationStatus,
  { label: string; className: string }
> = {
  valid: {
    label: "Verified",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  invalid: {
    label: "Invalid",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  invalid_syntax: {
    label: "Bad syntax",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  invalid_domain: {
    label: "Bad domain",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  risky: {
    label: "Likely Valid",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  unknown: {
    label: "Unknown",
    className: "border-gray-200 bg-gray-50 text-gray-600",
  },
  no_email: {
    label: "No email",
    className: "border-gray-200 bg-gray-50 text-gray-500",
  },
};

interface EmailVerificationBadgeProps {
  status?: EmailVerificationStatus | null;
  displayStatus?: EmailDisplayStatus | null;
}

export function EmailVerificationBadge({
  status,
  displayStatus,
}: EmailVerificationBadgeProps) {
  if (status === "no_email") return null;

  if (displayStatus) {
    const style = DISPLAY_STYLES[displayStatus];
    return (
      <span
        className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${style.className}`}
      >
        {emailDisplayLabel(displayStatus)}
      </span>
    );
  }

  if (!status) return null;

  const style = STATUS_STYLES[status];

  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}
