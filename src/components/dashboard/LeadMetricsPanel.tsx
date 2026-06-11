import Link from "next/link";
import { ArrowRight, Mail, Star, Users } from "lucide-react";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { LeadScoreBadge } from "@/components/leads/LeadScoreBadge";
import { formatStatValue } from "@/lib/dashboard/format";
import type { LeadMetrics, LeadScoreBucket } from "@/types/dashboard";

interface LeadMetricsPanelProps {
  metrics: LeadMetrics;
}

const bucketBarColors: Record<LeadScoreBucket["color"], string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  cyan: "bg-cyan-500",
  emerald: "bg-emerald-500",
};

export function LeadMetricsPanel({ metrics }: LeadMetricsPanelProps) {
  if (metrics.discoveredCount === 0) {
    return (
      <DashboardSection
        title="Lead metrics"
        description="Discover contacts from your searches to see pipeline stats here."
      >
        <Link
          href="/searches"
          className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
        >
          Go to Searches
          <ArrowRight className="h-4 w-4" />
        </Link>
      </DashboardSection>
    );
  }

  const maxBucketCount = Math.max(
    ...metrics.scoreBuckets.map((b) => b.count),
    1
  );

  return (
    <DashboardSection
      title="Lead metrics"
      description="Pipeline health across discovery, enrichment, scoring, and email verification."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          icon={Users}
          label="Discovered"
          value={formatStatValue(metrics.discoveredCount)}
          hint={`${metrics.enrichedCount} enriched`}
        />
        <MetricTile
          icon={Star}
          label="Scored"
          value={formatStatValue(metrics.scoredCount)}
          hint={
            metrics.averageScore !== null
              ? `Avg ${metrics.averageScore}/10`
              : "Run scoring on Leads"
          }
        />
        <MetricTile
          icon={Mail}
          label="With email"
          value={formatStatValue(metrics.withEmailCount)}
          hint={`${metrics.verifiedCount} verified`}
        />
        <MetricTile
          icon={Star}
          label="High quality"
          value={formatStatValue(metrics.highQualityCount)}
          hint="Score 8+"
          accent="emerald"
        />
      </div>

      {metrics.scoredCount > 0 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-slate-300">Score distribution</p>
            <ul className="mt-4 space-y-3">
              {metrics.scoreBuckets.map((bucket) => (
                <li key={bucket.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      {bucket.label}{" "}
                      <span className="text-slate-600">({bucket.range})</span>
                    </span>
                    <span className="font-medium text-slate-300">
                      {bucket.count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full transition-all ${bucketBarColors[bucket.color]}`}
                      style={{
                        width: `${(bucket.count / maxBucketCount) * 100}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {metrics.topLeads.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-300">Top leads</p>
                <Link
                  href="/leads"
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  View all
                </Link>
              </div>
              <ul className="mt-4 space-y-2">
                {metrics.topLeads.map((lead) => (
                  <li
                    key={lead.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-950/40 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {lead.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {lead.role} · {lead.company}
                      </p>
                    </div>
                    <LeadScoreBadge score={lead.score} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {metrics.scoredCount === 0 && metrics.enrichedCount > 0 && (
        <p className="mt-6 text-sm text-slate-500">
          Score your leads on the{" "}
          <Link href="/leads" className="text-cyan-400 hover:text-cyan-300">
            Leads page
          </Link>{" "}
          to unlock distribution charts and top-lead rankings.
        </p>
      )}
    </DashboardSection>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  hint,
  accent = "cyan",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  accent?: "cyan" | "emerald";
}) {
  const iconClass =
    accent === "emerald"
      ? "bg-emerald-500/10 text-emerald-400"
      : "bg-cyan-500/10 text-cyan-400";

  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconClass}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
