import { DEFAULT_FOLLOW_UP_DELAY_DAYS } from "@/lib/follow-ups/constants";
import {
  isContactFollowUpsPaused,
  scheduleFollowUp,
} from "@/lib/follow-ups/queries";

export async function scheduleDefaultFollowUp(
  userId: string,
  contactId: string,
  sourceEmailId: string
): Promise<void> {
  const paused = await isContactFollowUpsPaused(userId, contactId);
  if (paused) return;

  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + DEFAULT_FOLLOW_UP_DELAY_DAYS);

  await scheduleFollowUp(userId, {
    contactId,
    sourceEmailId,
    sequenceNumber: 1,
    scheduledAt: scheduledAt.toISOString(),
  });
}
