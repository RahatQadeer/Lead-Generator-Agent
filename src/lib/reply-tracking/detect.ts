import {
  getSentEmailsForReplyCheck,
  markEmailsReplyChecked,
  saveDetectedReplies,
} from "@/lib/reply-tracking/queries";
import { isReplyTrackingError } from "@/lib/reply-tracking/errors";
import {
  createReplyDetector,
  getConfiguredReplyTrackingProvider,
} from "@/lib/reply-tracking/factory";
import type { ReplyDetectionResult } from "@/types/reply-tracking";

export async function detectEmailReplies(
  userId: string
): Promise<ReplyDetectionResult> {
  const emails = await getSentEmailsForReplyCheck(userId);

  if (emails.length === 0) {
    return {
      provider: getConfiguredReplyTrackingProvider(),
      checkedCount: 0,
      repliesFound: 0,
      replies: [],
    };
  }

  const detector = createReplyDetector();
  const replies = await detector.detectReplies(userId, emails);

  await saveDetectedReplies(userId, replies);
  await markEmailsReplyChecked(
    userId,
    emails.map((email) => email.id)
  );

  return {
    provider: getConfiguredReplyTrackingProvider(),
    checkedCount: emails.length,
    repliesFound: replies.length,
    replies,
  };
}

export function toReplyTrackingErrorResponse(error: unknown) {
  if (isReplyTrackingError(error)) {
    return {
      success: false as const,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    };
  }

  return {
    success: false as const,
    error: {
      code: "DETECTION_FAILED" as const,
      message: "An unexpected error occurred while detecting replies.",
      retryable: false,
    },
  };
}
