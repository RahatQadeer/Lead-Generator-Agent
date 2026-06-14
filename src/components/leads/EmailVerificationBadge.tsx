import type { EmailVerificationStatus } from "@/types/email-verification";

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
    label: "Risky",
    className: "border-amber-200 bg-amber-50 text-amber-700",
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
  status: EmailVerificationStatus | null;
}

export function EmailVerificationBadge({ status }: EmailVerificationBadgeProps) {
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
