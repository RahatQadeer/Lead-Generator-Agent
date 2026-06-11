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
