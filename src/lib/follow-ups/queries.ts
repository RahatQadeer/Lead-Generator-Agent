import { toFollowUp, toFollowUpInsert } from "@/lib/follow-ups/mapper";
import { createClient } from "@/lib/supabase/server";
import type {
  FollowUp,
  FollowUpCancelReason,
  FollowUpPauseReason,
  FollowUpSummary,
  ScheduledFollowUpWithContext,
} from "@/types/follow-up";
import type { GeneratedFollowUpSuggestion } from "@/types/follow-up-suggestion";

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

export async function getFollowUpById(
  userId: string,
  followUpId: string
): Promise<FollowUp | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("id", followUpId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return toFollowUp(data);
}

export async function getScheduledFollowUpsWithContext(
  userId: string,
  limit = 20
): Promise<ScheduledFollowUpWithContext[]> {
  const followUps = await getScheduledFollowUps(userId, limit);
  if (followUps.length === 0) return [];

  const supabase = await createClient();
  const contactIds = [...new Set(followUps.map((f) => f.contactId))];
  const emailIds = [...new Set(followUps.map((f) => f.sourceEmailId))];

  const [contactsResult, emailsResult] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, full_name, company_name")
      .eq("user_id", userId)
      .in("id", contactIds),
    supabase
      .from("outreach_emails")
      .select("id, subject, sent_at, lead_company")
      .eq("user_id", userId)
      .in("id", emailIds),
  ]);

  const contactMap = new Map(
    (contactsResult.data ?? []).map((c) => [c.id, c])
  );
  const emailMap = new Map((emailsResult.data ?? []).map((e) => [e.id, e]));

  return followUps.map((followUp) => {
    const contact = contactMap.get(followUp.contactId);
    const email = emailMap.get(followUp.sourceEmailId);

    return {
      ...followUp,
      leadName: contact?.full_name ?? "Unknown",
      leadCompany:
        contact?.company_name ?? email?.lead_company ?? "Unknown",
      originalSubject: email?.subject ?? "(no subject)",
      originalSentAt: email?.sent_at ?? null,
    };
  });
}

export async function saveFollowUpSuggestion(
  userId: string,
  followUpId: string,
  suggestion: GeneratedFollowUpSuggestion
): Promise<FollowUp | null> {
  const supabase = await createClient();
  const updatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("follow_ups")
    .update({
      suggested_subject: suggestion.subject,
      suggested_body: suggestion.body,
      suggestion_provider: suggestion.provider,
      suggestion_model: suggestion.model,
      suggested_at: suggestion.generatedAt,
      updated_at: updatedAt,
    })
    .eq("id", followUpId)
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to save follow-up suggestion:", error?.message);
    return null;
  }

  return toFollowUp(data);
}

export async function linkFollowUpDraftEmail(
  userId: string,
  followUpId: string,
  draftEmailId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("follow_ups")
    .update({
      draft_email_id: draftEmailId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", followUpId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to link follow-up draft:", error.message);
  }
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
