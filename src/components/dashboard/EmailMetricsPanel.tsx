import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Mail,
  MessageSquare,
  Send,
  Sparkles,
} from "lucide-react";
import { EmailFollowUpBar } from "@/components/dashboard/EmailFollowUpBar";
import { EmailRecentRepliesSection } from "@/components/dashboard/EmailRecentRepliesSection";
import { SphereUniverseGraph } from "@/components/dashboard/SphereUniverseGraph";
import { DashboardPanelShell } from "@/components/dashboard/DashboardPanelShell";
import {
  LeadPipelineStrip,
  type LeadPipelineStep,
} from "@/components/dashboard/LeadPipelineStrip";
import { SequencedItemCard } from "@/components/dashboard/SequencedItemCard";
import {
  formatConversionRate,
  formatStatValue,
} from "@/lib/dashboard/format";
import { linkClassName } from "@/lib/ui/styles";
import type { EmailMetrics } from "@/types/dashboard";

interface EmailMetricsPanelProps {
  metrics: EmailMetrics;
}

const TONE_COLORS: Record<string, string> = {
  professional: "#38bdf8",
  friendly: "#a78bfa",
  formal: "#9ca3af",
  direct: "#fbbf24",
};

function campaignStatusClass(status: string): string {
  switch (status) {
    case "completed":
      return "text-emerald-700";
    case "partial":
      return "text-amber-700";
    case "failed":
      return "text-red-700";
    default:
      return "text-gray-500";
  }
}

function buildPipelineSteps(metrics: EmailMetrics): LeadPipelineStep[] {
  return [
    {
      icon: Mail,
      label: "Generated",
      value: formatStatValue(metrics.generatedCount),
      hint: `${metrics.draftCount} draft${metrics.draftCount === 1 ? "" : "s"}`,
      accent: "violet",
    },
    {
      icon: Send,
      label: "Sent",
      value: formatStatValue(metrics.sentCount),
      hint:
        metrics.campaignCount > 0
          ? `${metrics.campaignCount} campaign${metrics.campaignCount === 1 ? "" : "s"} launched`
          : "No campaigns yet",
      accent: "sky",
    },
    {
      icon: MessageSquare,
      label: "Replies",
      value: formatStatValue(metrics.repliedCount),
      hint: `${metrics.awaitingReplyCount} awaiting`,
      accent: "emerald",
    },
    {
      icon: Sparkles,
      label: "Conversion",
      value: formatConversionRate(metrics.conversionRate),
      hint: "Replies ÷ sent",
      accent: "amber",
    },
  ];
}

export function EmailMetricsPanel({ metrics }: EmailMetricsPanelProps) {
  if (metrics.generatedCount === 0) {
    return (
      <DashboardPanelShell icon={Mail} title="Email metrics">
        <Link href="/leads" className={linkClassName}>
          Generate emails from Leads
          <ArrowRight className="h-4 w-4" />
        </Link>
      </DashboardPanelShell>
    );
  }

  const hasRightColumn =
    metrics.toneBreakdown.length > 0 || metrics.recentCampaigns.length > 0;

  const toneTotal = metrics.toneBreakdown.reduce(
    (sum, item) => sum + item.count,
    0
  );

  return (
    <DashboardPanelShell icon={Mail} title="Email metrics">
      <div
        className={
          hasRightColumn
            ? "grid gap-8 lg:grid-cols-2 lg:gap-0"
            : "space-y-3"
        }
      >
        <div className={hasRightColumn ? "min-w-0 space-y-3 lg:pr-8" : ""}>
          <LeadPipelineStrip steps={buildPipelineSteps(metrics)} />

          <EmailFollowUpBar
            items={[
              {
                icon: Clock,
                label: "Follow-ups scheduled",
                value: formatStatValue(metrics.followUpScheduled),
                hint: "Pending sends",
              },
              {
                icon: Mail,
                label: "Follow-ups cancelled",
                value: formatStatValue(metrics.followUpCancelled),
                hint: "Stopped sequences",
              },
              {
                icon: Sparkles,
                label: "AI suggestions",
                value: formatStatValue(metrics.followUpWithSuggestion),
                hint: "Ready to review",
              },
            ]}
          />

          {metrics.recentReplies.length > 0 && (
            <div className="pt-3">
              <EmailRecentRepliesSection replies={metrics.recentReplies} />
            </div>
          )}
        </div>

        {hasRightColumn && (
          <div className="min-w-0 space-y-6 lg:border-l lg:border-gray-100 lg:pl-8">
            {metrics.toneBreakdown.length > 0 && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Tone breakdown
                  </h3>
                  <span className="shrink-0 text-xs text-gray-500">
                    <span className="font-medium uppercase tracking-wide">
                      Total{" "}
                    </span>
                    <span className="font-bold tabular-nums text-gray-900">
                      {formatStatValue(toneTotal)}
                    </span>
                  </span>
                </div>
                <div className="mt-3">
                  <SphereUniverseGraph
                    size="md"
                    nodes={metrics.toneBreakdown.map((item) => ({
                      name: item.label,
                      color: TONE_COLORS[item.tone] ?? "#38bdf8",
                      value: formatStatValue(item.count),
                    }))}
                    ariaLabel="Email tone distribution universe."
                  />
                </div>
              </div>
            )}

            {metrics.recentCampaigns.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Recent campaigns
                </h3>
                <div className="mt-3 space-y-2">
                  {metrics.recentCampaigns.map((campaign) => (
                    <SequencedItemCard
                      key={campaign.id}
                      href="/emails"
                      icon={Send}
                      iconClassName="bg-sky-50 text-sky-600"
                      title={campaign.name}
                      subtitle={`${campaign.sentCount}/${campaign.totalCount} sent`}
                      meta={[
                        {
                          icon: Mail,
                          text:
                            campaign.failedCount > 0
                              ? `${campaign.failedCount} failed`
                              : "All delivered",
                        },
                      ]}
                      trailing={
                        <span
                          className={`text-xs font-medium capitalize ${campaignStatusClass(campaign.status)}`}
                        >
                          {campaign.status}
                        </span>
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardPanelShell>
  );
}
