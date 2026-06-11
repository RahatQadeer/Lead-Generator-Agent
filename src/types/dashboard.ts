export interface DashboardStats {
  searchCount: number;
  leadCount: number;
  emailsSent: number;
  replyCount: number;
  conversionRate: number | null;
  draftCount: number;
  campaignCount: number;
}

export interface DashboardOnboardingStep {
  step: number;
  label: string;
  done: boolean;
  href: string;
}

export interface LeadScoreBucket {
  label: string;
  range: string;
  count: number;
  color: "red" | "amber" | "cyan" | "emerald";
}

export interface TopLeadMetric {
  id: string;
  name: string;
  role: string;
  company: string;
  score: number;
}

export interface LeadMetrics {
  discoveredCount: number;
  enrichedCount: number;
  scoredCount: number;
  withEmailCount: number;
  verifiedCount: number;
  averageScore: number | null;
  highQualityCount: number;
  pausedCount: number;
  scoreBuckets: LeadScoreBucket[];
  topLeads: TopLeadMetric[];
}

export interface EmailToneMetric {
  tone: string;
  label: string;
  count: number;
}

export interface RecentCampaignMetric {
  id: string;
  name: string;
  status: string;
  sentCount: number;
  totalCount: number;
  failedCount: number;
}

export interface RecentReplyMetric {
  id: string;
  subject: string;
  leadName: string;
  repliedAt: string;
  snippet: string | null;
}

export interface EmailMetrics {
  generatedCount: number;
  draftCount: number;
  sentCount: number;
  repliedCount: number;
  awaitingReplyCount: number;
  conversionRate: number | null;
  campaignCount: number;
  campaignEmailsSent: number;
  campaignEmailsFailed: number;
  followUpScheduled: number;
  followUpCancelled: number;
  followUpWithSuggestion: number;
  toneBreakdown: EmailToneMetric[];
  recentCampaigns: RecentCampaignMetric[];
  recentReplies: RecentReplyMetric[];
}

export interface ConversionFunnelStage {
  key: string;
  label: string;
  count: number;
  rateFromPrevious: number | null;
  rateFromStart: number | null;
}

export interface ConversionRateMetric {
  key: string;
  label: string;
  value: number | null;
  description: string;
}

export interface ConversionMetrics {
  discoveredCount: number;
  enrichedCount: number;
  contactedCount: number;
  repliedContactCount: number;
  emailsSent: number;
  emailsReplied: number;
  funnel: ConversionFunnelStage[];
  rates: ConversionRateMetric[];
}
