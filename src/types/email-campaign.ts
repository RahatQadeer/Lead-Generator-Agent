import type { EmailSendingProviderName } from "@/types/email-sending";

export type OutreachCampaignStatus =
  | "running"
  | "completed"
  | "partial"
  | "failed";

export interface OutreachCampaign {
  id: string;
  name: string;
  status: OutreachCampaignStatus;
  provider: EmailSendingProviderName;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface CampaignSendFailure {
  emailId: string;
  leadName: string;
  reason: string;
}

export interface CampaignSendResult {
  campaign: OutreachCampaign;
  failures: CampaignSendFailure[];
}

export interface CampaignSummary {
  draftCount: number;
  sentCount: number;
  campaignCount: number;
}
