import { MessageSquare, Send, FileText, Layers } from "lucide-react";
import {
  LeadPipelineStrip,
  type LeadPipelineStep,
} from "@/components/dashboard/LeadPipelineStrip";
import type { CampaignSummary } from "@/types/email-campaign";
import type { ReplySummary } from "@/types/reply-tracking";

interface EmailCampaignStatsProps {
  summary: CampaignSummary;
  replySummary: ReplySummary;
}

export function EmailCampaignStats({
  summary,
  replySummary,
}: EmailCampaignStatsProps) {
  const steps: LeadPipelineStep[] = [
    {
      icon: FileText,
      label: "Drafts",
      value: String(summary.draftCount),
      hint: "Ready to send",
      accent: "violet",
    },
    {
      icon: Send,
      label: "Sent",
      value: String(summary.sentCount),
      hint: `${summary.campaignCount} campaign${summary.campaignCount === 1 ? "" : "s"}`,
      accent: "sky",
    },
    {
      icon: Layers,
      label: "Campaigns",
      value: String(summary.campaignCount),
      hint: "Batch launches",
      accent: "emerald",
    },
    {
      icon: MessageSquare,
      label: "Replies",
      value: String(replySummary.repliedCount),
      hint:
        replySummary.sentCount > 0
          ? `of ${replySummary.sentCount} sent`
          : "No sends yet",
      accent: "amber",
    },
  ];

  return <LeadPipelineStrip steps={steps} />;
}
