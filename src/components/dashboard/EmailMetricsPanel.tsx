import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Mail,
  MessageSquare,
  Send,
  Sparkles,
} from "lucide-react";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import {
  formatConversionRate,
  formatStatValue,
} from "@/lib/dashboard/format";
import type { EmailMetrics } from "@/types/dashboard";

interface EmailMetricsPanelProps {
  metrics: EmailMetrics;
}

const toneBarColors: Record<string, string> = {
  professional: "bg-cyan-500",
  friendly: "bg-violet-500",
  formal: "bg-slate-400",
  direct: "bg-amber-500",
};

function campaignStatusClass(status: string): string {
  switch (status) {
    case "completed":
      return "text-emerald-300";
    case "partial":
      return "text-amber-300";
    case "failed":
      return "text-rose-300";
    default:
      return "text-slate-400";
  }
}

function formatReplyDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function EmailMetricsPanel({ metrics }: EmailMetricsPanelProps) {
  if (metrics.generatedCount === 0) {
    return (
      <DashboardSection
        title="Email metrics"
        description="Generate and send outreach emails to track campaign performance."
      >
        <Link
          href="/leads"
          className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
        >
          Generate emails from Leads
          <ArrowRight className="h-4 w-4" />
        </Link>
      </DashboardSection>
    );
  }

  const maxToneCount = Math.max(
    ...metrics.toneBreakdown.map((t) => t.count),
    1
  );

  return (
    <DashboardSection
      title="Email metrics"
      description="Outreach volume, reply rates, campaigns, and follow-up activity."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          icon={Mail}
          label="Generated"
          value={formatStatValue(metrics.generatedCount)}
          hint={`${metrics.draftCount} draft${metrics.draftCount === 1 ? "" : "s"}`}
        />
        <MetricTile
          icon={Send}
          label="Sent"
          value={formatStatValue(metrics.sentCount)}
          hint={
            metrics.campaignCount > 0
              ? `${metrics.campaignCount} campaign${metrics.campaignCount === 1 ? "" : "s"}`
              : "No campaigns yet"
          }
        />
        <MetricTile
          icon={MessageSquare}
          label="Replies"
          value={formatStatValue(metrics.repliedCount)}
          hint={`${metrics.awaitingReplyCount} awaiting`}
          accent="emerald"
        />
        <MetricTile
          icon={Sparkles}
          label="Conversion"
          value={formatConversionRate(metrics.conversionRate)}
          hint="Replies ÷ sent"
          accent="violet"
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <SecondaryMetric
          label="Follow-ups scheduled"
          value={formatStatValue(metrics.followUpScheduled)}
        />
        <SecondaryMetric
          label="Follow-ups cancelled"
          value={formatStatValue(metrics.followUpCancelled)}
        />
        <SecondaryMetric
          label="AI suggestions"
          value={formatStatValue(metrics.followUpWithSuggestion)}
        />
      </div>

      {(metrics.toneBreakdown.length > 0 ||
        metrics.recentCampaigns.length > 0 ||
        metrics.recentReplies.length > 0) && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {metrics.toneBreakdown.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-300">Tone breakdown</p>
              <ul className="mt-4 space-y-3">
                {metrics.toneBreakdown.map((item) => (
                  <li key={item.tone}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-400">{item.label}</span>
                      <span className="font-medium text-slate-300">
                        {item.count}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full ${toneBarColors[item.tone] ?? "bg-cyan-500"}`}
                        style={{
                          width: `${(item.count / maxToneCount) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {metrics.recentReplies.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-300">
                  Recent replies
                </p>
                <Link
                  href="/emails"
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  View emails
                </Link>
              </div>
              <ul className="mt-4 space-y-2">
                {metrics.recentReplies.map((reply) => (
                  <li
                    key={reply.id}
                    className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium text-white">
                        {reply.leadName}
                      </p>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" />
                        {formatReplyDate(reply.repliedAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {reply.subject}
                    </p>
                    {reply.snippet && (
                      <p className="mt-1 line-clamp-2 text-xs text-emerald-300/80">
                        {reply.snippet}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {metrics.recentCampaigns.length > 0 && (
            <div className={metrics.toneBreakdown.length > 0 ? "lg:col-span-2" : ""}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-300">
                  Recent campaigns
                </p>
                <Link
                  href="/emails"
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  View all
                </Link>
              </div>
              <ul className="mt-4 space-y-2">
                {metrics.recentCampaigns.map((campaign) => (
                  <li
                    key={campaign.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-950/40 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {campaign.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {campaign.sentCount}/{campaign.totalCount} sent
                        {campaign.failedCount > 0
                          ? ` · ${campaign.failedCount} failed`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium capitalize ${campaignStatusClass(campaign.status)}`}
                    >
                      {campaign.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
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
  accent?: "cyan" | "emerald" | "violet";
}) {
  const iconClass = {
    cyan: "bg-cyan-500/10 text-cyan-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    violet: "bg-violet-500/10 text-violet-400",
  }[accent];

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

function SecondaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-slate-950/30 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
