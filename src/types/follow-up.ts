export type FollowUpStatus = "scheduled" | "cancelled" | "sent" | "skipped";

export type FollowUpCancelReason = "replied" | "manual";

export type FollowUpPauseReason = "replied" | "manual";

export interface FollowUpSuggestion {
  subject: string;
  body: string;
  provider: string;
  model: string | null;
  suggestedAt: string;
}

export interface FollowUp {
  id: string;
  contactId: string;
  sourceEmailId: string;
  sequenceNumber: number;
  scheduledAt: string;
  status: FollowUpStatus;
  cancelReason: FollowUpCancelReason | null;
  cancelledAt: string | null;
  createdAt: string;
  suggestion: FollowUpSuggestion | null;
  draftEmailId: string | null;
}

export interface ScheduledFollowUpWithContext extends FollowUp {
  leadName: string;
  leadCompany: string;
  originalSubject: string;
  originalSentAt: string | null;
}

export interface FollowUpSummary {
  scheduledCount: number;
  cancelledCount: number;
  pausedContactCount: number;
}
