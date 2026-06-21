import { FollowUpBlockedError } from "@/lib/follow-ups/errors";
import { isContactFollowUpsPaused } from "@/lib/follow-ups/queries";

export async function assertContactCanReceiveOutreach(
  userId: string,
  contactId: string
): Promise<void> {
  const paused = await isContactFollowUpsPaused(userId, contactId);
  if (paused) {
    throw new FollowUpBlockedError(
      "Follow-ups are stopped for this contact because they replied."
    );
  }
}
