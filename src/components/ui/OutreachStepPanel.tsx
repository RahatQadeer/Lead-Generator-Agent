import {
  alertErrorClassName,
  btnSmPrimaryClassName,
  outreachStepClassName,
} from "@/lib/ui/styles";

interface OutreachStepPanelProps {
  step: number;
  title: string;
  description: string;
  action: React.ReactNode;
  children?: React.ReactNode;
}

export function OutreachStepPanel({
  step,
  title,
  description,
  action,
  children,
}: OutreachStepPanelProps) {
  return (
    <div className={outreachStepClassName}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            Step {step} · {title}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{description}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      {children}
    </div>
  );
}

export { alertErrorClassName, btnSmPrimaryClassName };
