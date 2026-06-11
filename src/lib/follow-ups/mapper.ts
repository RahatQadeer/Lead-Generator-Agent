import type { Database } from "@/types/database";
import type { FollowUp } from "@/types/follow-up";

type FollowUpRow = Database["public"]["Tables"]["follow_ups"]["Row"];
type FollowUpInsert = Database["public"]["Tables"]["follow_ups"]["Insert"];

export function toFollowUpInsert(
  userId: string,
  input: {
    contactId: string;
    sourceEmailId: string;
    sequenceNumber: number;
    scheduledAt: string;
  }
): FollowUpInsert {
  return {
    user_id: userId,
    contact_id: input.contactId,
    source_email_id: input.sourceEmailId,
    sequence_number: input.sequenceNumber,
    scheduled_at: input.scheduledAt,
    status: "scheduled",
    updated_at: new Date().toISOString(),
  };
}

function toFollowUpSuggestion(row: FollowUpRow): FollowUp["suggestion"] {
  if (!row.suggested_subject || !row.suggested_body || !row.suggested_at) {
    return null;
  }

  return {
    subject: row.suggested_subject,
    body: row.suggested_body,
    provider: row.suggestion_provider ?? "unknown",
    model: row.suggestion_model,
    suggestedAt: row.suggested_at,
  };
}

export function toFollowUp(row: FollowUpRow): FollowUp {
  return {
    id: row.id,
    contactId: row.contact_id,
    sourceEmailId: row.source_email_id,
    sequenceNumber: row.sequence_number,
    scheduledAt: row.scheduled_at,
    status: row.status as FollowUp["status"],
    cancelReason: row.cancel_reason as FollowUp["cancelReason"],
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    suggestion: toFollowUpSuggestion(row),
    draftEmailId: row.draft_email_id,
  };
}
