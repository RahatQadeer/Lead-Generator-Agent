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
