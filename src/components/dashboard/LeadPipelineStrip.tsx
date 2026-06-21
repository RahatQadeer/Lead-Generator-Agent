import {
  metricAccentStyles,
  metricGlowClassName,
  type MetricAccent,
} from "@/components/dashboard/metric-accent";
import { dashboardStatCardClassName } from "@/lib/ui/styles";
import type { LucideIcon } from "lucide-react";

export interface LeadPipelineStep {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  accent: MetricAccent;
}

interface LeadPipelineStripProps {
  steps: LeadPipelineStep[];
}

export function LeadPipelineStrip({ steps }: LeadPipelineStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {steps.map((step) => {
        const Icon = step.icon;
        const accent = metricAccentStyles[step.accent];

        return (
          <div
            key={step.label}
            className={`${dashboardStatCardClassName} px-4 py-4 text-center`}
          >
            <div
              className={`${metricGlowClassName} ${accent.glow}`}
              aria-hidden
            />

            <div className="relative">
              <div
                className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full ring-1 ${accent.icon}`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </div>

              <p className="mt-3 text-xs font-medium text-gray-500">
                {step.label}
              </p>

              <p className="mt-1 text-xl font-bold leading-none tracking-[-0.02em] tabular-nums text-gray-950">
                {step.value}
              </p>

              <p className="mt-1.5 text-xs text-gray-400">{step.hint}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
