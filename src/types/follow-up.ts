export type FollowUpStatus = "scheduled" | "cancelled" | "sent" | "skipped";

export type FollowUpCancelReason = "replied" | "manual";

export type FollowUpPauseReason = "replied" | "manual";

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
}

export interface FollowUpSummary {
  scheduledCount: number;
  cancelledCount: number;
  pausedContactCount: number;
}
