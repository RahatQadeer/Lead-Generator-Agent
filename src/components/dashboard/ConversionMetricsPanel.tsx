import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { formatConversionRate } from "@/lib/dashboard/format";
import type { ConversionMetrics } from "@/types/dashboard";

interface ConversionMetricsPanelProps {
  metrics: ConversionMetrics;
}

const funnelColors = [
  "from-cyan-500/80 to-cyan-600/40",
  "from-violet-500/80 to-violet-600/40",
  "from-amber-500/80 to-amber-600/40",
  "from-emerald-500/80 to-emerald-600/40",
];

export function ConversionMetricsPanel({
  metrics,
}: ConversionMetricsPanelProps) {
  if (metrics.discoveredCount === 0) {
    return (
      <DashboardSection
        title="Conversion metrics"
        description="Run discovery to track how leads move through your pipeline."
      >
        <Link
          href="/searches"
          className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
        >
          Start with a search
          <ArrowRight className="h-4 w-4" />
        </Link>
      </DashboardSection>
    );
  }

  const maxFunnelCount = Math.max(
    ...metrics.funnel.map((s) => s.count),
    1
  );

  return (
    <DashboardSection
      title="Conversion metrics"
      description="Pipeline funnel and stage conversion rates from discovery to reply."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.rates.map((rate) => (
          <div
            key={rate.key}
            className="rounded-xl border border-white/5 bg-slate-950/40 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{rate.label}</span>
              <TrendingUp className="h-3.5 w-3.5 text-slate-600" />
            </div>
            <p className="mt-2 text-xl font-semibold text-white">
              {formatConversionRate(rate.value)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{rate.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <p className="text-sm font-medium text-slate-300">Pipeline funnel</p>
        <ul className="mt-4 space-y-3">
          {metrics.funnel.map((stage, index) => {
            const widthPct = Math.max(
              (stage.count / maxFunnelCount) * 100,
              stage.count > 0 ? 12 : 4
            );

            return (
              <li key={stage.key}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-300">{stage.label}</span>
                  <span className="text-slate-500">
                    {stage.count}
                    {stage.rateFromPrevious !== null && index > 0 && (
                      <span className="ml-2 text-slate-600">
                        ({formatConversionRate(stage.rateFromPrevious)} from prev)
                      </span>
                    )}
                    {stage.rateFromStart !== null && index > 0 && (
                      <span className="ml-2 text-cyan-500/70">
                        {formatConversionRate(stage.rateFromStart)} of pipeline
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${funnelColors[index] ?? funnelColors[0]}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {metrics.contactedCount === 0 && metrics.enrichedCount > 0 && (
        <p className="mt-6 text-sm text-slate-500">
          Send outreach from the{" "}
          <Link href="/emails" className="text-cyan-400 hover:text-cyan-300">
            Emails page
          </Link>{" "}
          to populate contact and reply conversion rates.
        </p>
      )}
    </DashboardSection>
  );
}
