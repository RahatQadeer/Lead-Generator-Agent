import { headingSectionClassName } from "@/lib/ui/styles";

interface SettingsSectionHeadingProps {
  step: number;
  title: string;
  description: string;
}

export function SettingsSectionHeading({
  step,
  title,
  description,
}: SettingsSectionHeadingProps) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold tabular-nums text-white shadow-sm"
        aria-hidden
      >
        {step}
      </span>
      <div className="min-w-0 pt-0.5">
        <h2 className={headingSectionClassName}>{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}
