import { Loader2, type LucideIcon } from "lucide-react";
import { btnSmPrimaryClassName } from "@/lib/ui/styles";

interface StepActionButtonProps {
  icon: LucideIcon;
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  onClick: () => void;
}

export function StepActionButton({
  icon: Icon,
  label,
  loading = false,
  loadingLabel,
  disabled = false,
  onClick,
}: StepActionButtonProps) {
  const busyLabel = loadingLabel ?? label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={btnSmPrimaryClassName}
      aria-label={loading ? busyLabel : label}
      aria-busy={loading}
      title={label}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
      ) : (
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      )}
      <span className="sr-only">{loading ? busyLabel : label}</span>
    </button>
  );
}
