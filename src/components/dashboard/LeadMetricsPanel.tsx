import Link from "next/link";
import { ArrowRight, Mail, Star, Users } from "lucide-react";
import { DashboardPanelShell } from "@/components/dashboard/DashboardPanelShell";
import {
  LeadPipelineStrip,
  type LeadPipelineStep,
} from "@/components/dashboard/LeadPipelineStrip";
import { ScoreDistributionChart } from "@/components/dashboard/ScoreDistributionChart";
import { TopLeadsSection } from "@/components/dashboard/TopLeadsSection";
import { formatStatValue } from "@/lib/dashboard/format";
import { linkClassName } from "@/lib/ui/styles";
import type { LeadMetrics } from "@/types/dashboard";

interface LeadMetricsPanelProps {
  metrics: LeadMetrics;
}

function buildPipelineSteps(metrics: LeadMetrics): LeadPipelineStep[] {
  return [
    {
      icon: Users,
      label: "Discovered",
      value: formatStatValue(metrics.discoveredCount),
      hint: `${metrics.enrichedCount} enriched`,
      accent: "violet",
    },
    {
      icon: Star,
      label: "Scored",
      value: formatStatValue(metrics.scoredCount),
      hint:
        metrics.averageScore !== null
          ? `Avg ${metrics.averageScore}/10`
          : "Run scoring",
      accent: "amber",
    },
    {
      icon: Mail,
      label: "With email",
      value: formatStatValue(metrics.withEmailCount),
      hint: `${metrics.verifiedCount} verified`,
      accent: "sky",
    },
    {
      icon: Star,
      label: "High quality",
      value: formatStatValue(metrics.highQualityCount),
      hint: "Score 8+",
      accent: "emerald",
    },
  ];
}

export function LeadMetricsPanel({ metrics }: LeadMetricsPanelProps) {
  if (metrics.discoveredCount === 0) {
    return (
      <DashboardPanelShell icon={Users} title="Lead metrics">
        <Link href="/searches" className={linkClassName}>
          Go to Searches
          <ArrowRight className="h-4 w-4" />
        </Link>
      </DashboardPanelShell>
    );
  }

  return (
    <DashboardPanelShell icon={Users} title="Lead metrics">
      <LeadPipelineStrip steps={buildPipelineSteps(metrics)} />

      {metrics.scoredCount > 0 && (
        <div className="mt-6 space-y-6 border-t border-gray-100 pt-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Score distribution
            </h3>
            <div className="mt-3">
              <ScoreDistributionChart
                buckets={metrics.scoreBuckets}
                averageScore={metrics.averageScore}
              />
            </div>
          </div>

          {metrics.topLeads.length > 0 && (
            <TopLeadsSection leads={metrics.topLeads} />
          )}
        </div>
      )}

      {metrics.scoredCount === 0 && metrics.enrichedCount > 0 && (
        <p className="mt-6 text-sm text-gray-500">
          Score your leads on the{" "}
          <Link href="/leads" className={linkClassName}>
            Leads page
          </Link>{" "}
          to unlock distribution and rankings.
        </p>
      )}
    </DashboardPanelShell>
  );
}
