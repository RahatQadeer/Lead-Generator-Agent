import { stopFollowUpsAfterReply } from "@/lib/follow-ups/queries";
import { createClient } from "@/lib/supabase/server";
import type {
  DetectedReply,
  ReplySummary,
  SentEmailForReplyCheck,
} from "@/types/reply-tracking";

export async function getSentEmailsForReplyCheck(
  userId: string
): Promise<SentEmailForReplyCheck[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outreach_emails")
    .select("id, contact_id, subject, recipient_email, sent_at, gmail_message_id, provider_thread_id, contacts(full_name, email)")
    .eq("user_id", userId)
    .eq("status", "sent")
    .eq("reply_status", "none")
    .not("recipient_email", "is", null)
    .order("sent_at", { ascending: true });

  if (error || !data) return [];

  type ReplyCheckRow = {
    id: string;
    contact_id: string;
    subject: string;
    recipient_email: string | null;
    sent_at: string | null;
    gmail_message_id: string | null;
    provider_thread_id: string | null;
    contacts: { full_name: string; email: string | null } | null;
  };

  return (data as ReplyCheckRow[])
    .map((row) => {
      const contact = row.contacts as {
        full_name: string;
        email: string | null;
      } | null;
      const recipientEmail = row.recipient_email ?? contact?.email;
      if (!recipientEmail) return null;

      return {
        id: row.id,
        contactId: row.contact_id,
        leadName: contact?.full_name ?? "Unknown",
        recipientEmail,
        subject: row.subject,
        sentAt: row.sent_at ?? new Date().toISOString(),
        providerMessageId: row.gmail_message_id,
        providerThreadId: row.provider_thread_id,
      };
    })
    .filter((row): row is SentEmailForReplyCheck => row !== null);
}

export async function saveDetectedReplies(
  userId: string,
  replies: DetectedReply[]
): Promise<void> {
  if (replies.length === 0) return;

  const supabase = await createClient();

  for (const reply of replies) {
    const { error } = await supabase
      .from("outreach_emails")
      .update({
        reply_status: "replied",
        replied_at: reply.repliedAt,
        reply_snippet: reply.snippet,
        reply_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", reply.emailId)
      .eq("user_id", userId);

    if (error) {
      console.error(`Failed to save reply for ${reply.emailId}:`, error.message);
      continue;
    }

    await stopFollowUpsAfterReply(userId, reply.emailId);
  }
}

export async function markEmailsReplyChecked(
  userId: string,
  emailIds: string[]
): Promise<void> {
  if (emailIds.length === 0) return;

  const supabase = await createClient();
  const checkedAt = new Date().toISOString();

  const { error } = await supabase
    .from("outreach_emails")
    .update({
      reply_checked_at: checkedAt,
      updated_at: checkedAt,
    })
    .eq("user_id", userId)
    .in("id", emailIds)
    .eq("reply_status", "none");

  if (error) {
    console.error("Failed to mark emails reply-checked:", error.message);
  }
}

export async function getReplySummary(userId: string): Promise<ReplySummary> {
  const supabase = await createClient();

  const [sent, replied, awaiting] = await Promise.all([
    supabase
      .from("outreach_emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "sent"),
    supabase
      .from("outreach_emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("reply_status", "replied"),
    supabase
      .from("outreach_emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "sent")
      .eq("reply_status", "none"),
  ]);

  return {
    sentCount: sent.count ?? 0,
    repliedCount: replied.count ?? 0,
    awaitingReplyCount: awaiting.count ?? 0,
  };
}

export async function getReplyCount(userId: string): Promise<number> {
  const summary = await getReplySummary(userId);
  return summary.repliedCount;
}
