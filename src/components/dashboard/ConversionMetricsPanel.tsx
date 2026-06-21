import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { ConversionRatesChart } from "@/components/dashboard/ConversionRatesChart";
import { DashboardPanelShell } from "@/components/dashboard/DashboardPanelShell";
import { PipelineFunnelChart } from "@/components/dashboard/PipelineFunnelChart";
import { formatStatValue } from "@/lib/dashboard/format";
import { linkClassName } from "@/lib/ui/styles";
import type { ConversionMetrics } from "@/types/dashboard";

interface ConversionMetricsPanelProps {
  metrics: ConversionMetrics;
}

export function ConversionMetricsPanel({
  metrics,
}: ConversionMetricsPanelProps) {
  if (metrics.discoveredCount === 0) {
    return (
      <DashboardPanelShell icon={TrendingUp} title="Conversion metrics">
        <Link href="/searches" className={linkClassName}>
          Start with a search
          <ArrowRight className="h-4 w-4" />
        </Link>
      </DashboardPanelShell>
    );
  }

  return (
    <DashboardPanelShell icon={TrendingUp} title="Conversion metrics">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-0">
        <div className="min-w-0 lg:pr-8">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Conversion rates
          </h3>
          <div className="mt-4">
            <ConversionRatesChart rates={metrics.rates} />
          </div>
        </div>

        <div className="min-w-0 lg:border-l lg:border-gray-100 lg:pl-8">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Pipeline funnel
            </h3>
            <span className="shrink-0 text-xs text-gray-500">
              <span className="font-medium uppercase tracking-wide">
                Total{" "}
              </span>
              <span className="font-bold tabular-nums text-gray-900">
                {formatStatValue(metrics.discoveredCount)}
              </span>
            </span>
          </div>
          <div className="mt-4">
            <PipelineFunnelChart stages={metrics.funnel} />
          </div>
        </div>
      </div>

      {metrics.contactedCount === 0 && metrics.enrichedCount > 0 && (
        <p className="mt-6 border-t border-gray-100 pt-4 text-sm text-gray-500">
          Send outreach from the{" "}
          <Link href="/emails" className={linkClassName}>
            Emails page
          </Link>{" "}
          to populate contact and reply conversion rates.
        </p>
      )}
    </DashboardPanelShell>
  );
}
