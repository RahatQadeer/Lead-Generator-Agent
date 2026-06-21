import type { EmailVerificationStatus } from "@/types/email-verification";

const STATUS_STYLES: Record<
  EmailVerificationStatus,
  { label: string; className: string }
> = {
  valid: {
    label: "Verified",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  invalid: {
    label: "Invalid",
    className: "border-red-500/30 bg-red-500/10 text-red-300",
  },
  invalid_syntax: {
    label: "Bad syntax",
    className: "border-red-500/30 bg-red-500/10 text-red-300",
  },
  invalid_domain: {
    label: "Bad domain",
    className: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  },
  risky: {
    label: "Risky",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  unknown: {
    label: "Unknown",
    className: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  },
  no_email: {
    label: "No email",
    className: "border-slate-500/30 bg-slate-500/10 text-slate-400",
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
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}
