import type { LucideIcon } from "lucide-react";
import {
  alertErrorClassName,
  btnSmPrimaryClassName,
  iconTileSmClassName,
  outreachStepClassName,
} from "@/lib/ui/styles";
import type { PipelineStepControl } from "@/types/search-pipeline";

interface OutreachStepPanelProps {
  step: number;
  title: string;
  description?: string;
  icon?: LucideIcon;
  action: React.ReactNode;
  children?: React.ReactNode;
  stepControl?: PipelineStepControl;
}

export function OutreachStepPanel({
  step,
  title,
  description,
  icon: Icon,
  action,
  children,
  stepControl,
}: OutreachStepPanelProps) {
  const statusMessage =
    stepControl?.skipped && stepControl.skippedReason
      ? stepControl.skippedReason
      : stepControl?.enabled === false
        ? stepControl.lockedReason
        : stepControl?.complete
          ? "Completed — you can run this step again to refresh results."
          : undefined;

  return (
    <div
      className={`${outreachStepClassName} ${
        stepControl?.enabled === false ? "opacity-80" : ""
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <div className={iconTileSmClassName} aria-hidden>
              <Icon className="h-4 w-4" strokeWidth={2} />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              Step {step} · {title}
            {stepControl?.complete ? (
              <span className="ml-2 text-xs font-medium text-emerald-700">Done</span>
            ) : null}
            {stepControl?.skipped ? (
              <span className="ml-2 text-xs font-medium text-gray-500">Skipped</span>
            ) : null}
          </p>
          {description ? (
            <p className="mt-0.5 text-xs text-gray-500">{description}</p>
          ) : null}
          {statusMessage ? (
            <p
              className={`mt-1 text-xs ${
                stepControl?.enabled === false
                  ? "text-amber-800"
                  : stepControl?.complete
                    ? "text-emerald-700"
                    : "text-gray-500"
              }`}
            >
              {statusMessage}
            </p>
          ) : null}
          </div>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      {children}
    </div>
  );
}

export { alertErrorClassName, btnSmPrimaryClassName };
