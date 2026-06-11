import { toFollowUp, toFollowUpInsert } from "@/lib/follow-ups/mapper";
import { createClient } from "@/lib/supabase/server";
import type {
  FollowUp,
  FollowUpCancelReason,
  FollowUpPauseReason,
  FollowUpSummary,
} from "@/types/follow-up";

export async function isContactFollowUpsPaused(
  userId: string,
  contactId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("follow_ups_paused")
    .eq("id", contactId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return false;

  return data.follow_ups_paused;
}

export async function getContactIdForEmail(
  userId: string,
  emailId: string
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outreach_emails")
    .select("contact_id")
    .eq("id", emailId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return data.contact_id;
}

export async function scheduleFollowUp(
  userId: string,
  input: {
    contactId: string;
    sourceEmailId: string;
    sequenceNumber?: number;
    scheduledAt: string;
  }
): Promise<FollowUp | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("follow_ups")
    .insert(
      toFollowUpInsert(userId, {
        contactId: input.contactId,
        sourceEmailId: input.sourceEmailId,
        sequenceNumber: input.sequenceNumber ?? 1,
        scheduledAt: input.scheduledAt,
      })
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to schedule follow-up:", error?.message);
    return null;
  }

  return toFollowUp(data);
}

export async function cancelScheduledFollowUps(
  userId: string,
  contactId: string,
  reason: FollowUpCancelReason
): Promise<number> {
  const supabase = await createClient();
  const cancelledAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("follow_ups")
    .update({
      status: "cancelled",
      cancel_reason: reason,
      cancelled_at: cancelledAt,
      updated_at: cancelledAt,
    })
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .eq("status", "scheduled")
    .select("id");

  if (error || !data) return 0;

  return data.length;
}

export async function pauseContactFollowUps(
  userId: string,
  contactId: string,
  reason: FollowUpPauseReason
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts")
    .update({
      follow_ups_paused: true,
      follow_ups_paused_reason: reason,
      follow_ups_paused_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", contactId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to pause contact follow-ups:", error.message);
  }
}

export async function stopFollowUpsAfterReply(
  userId: string,
  emailId: string
): Promise<{ contactId: string; cancelledCount: number } | null> {
  const contactId = await getContactIdForEmail(userId, emailId);
  if (!contactId) return null;

  const cancelledCount = await cancelScheduledFollowUps(
    userId,
    contactId,
    "replied"
  );
  await pauseContactFollowUps(userId, contactId, "replied");

  return { contactId, cancelledCount };
}

export async function getScheduledFollowUps(
  userId: string,
  limit = 20
): Promise<FollowUp[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  return data.map(toFollowUp);
}

export async function getFollowUpSummary(
  userId: string
): Promise<FollowUpSummary> {
  const supabase = await createClient();

  const [scheduled, cancelled, paused] = await Promise.all([
    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "scheduled"),
    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "cancelled")
      .eq("cancel_reason", "replied"),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("follow_ups_paused", true),
  ]);

  return {
    scheduledCount: scheduled.count ?? 0,
    cancelledCount: cancelled.count ?? 0,
    pausedContactCount: paused.count ?? 0,
  };
}

export async function getPausedContactIds(userId: string): Promise<Set<string>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", userId)
    .eq("follow_ups_paused", true);

  if (error || !data) return new Set();

  return new Set(data.map((row) => row.id));
}
