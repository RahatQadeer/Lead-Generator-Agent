import {
  getSentEmailsForReplyCheck,
  markEmailsReplyChecked,
  saveDetectedReplies,
} from "@/lib/reply-tracking/queries";
import { isReplyTrackingError } from "@/lib/reply-tracking/errors";
import {
  createReplyDetectorForProvider,
  type ReplyTrackingProviderName,
} from "@/lib/reply-tracking/factory";
import { resolveReplyTrackingProvider } from "@/lib/reply-tracking/resolve-provider";
import type { ReplyDetectionResult } from "@/types/reply-tracking";

export async function detectEmailReplies(
  userId: string
): Promise<ReplyDetectionResult> {
  const emails = await getSentEmailsForReplyCheck(userId);
  const provider = await resolveReplyTrackingProvider(userId);

  if (emails.length === 0) {
    return {
      provider,
      checkedCount: 0,
      repliesFound: 0,
      replies: [],
    };
  }

  const detector = createReplyDetectorForProvider(provider);
  const replies = await detector.detectReplies(userId, emails);

  await saveDetectedReplies(userId, replies);
  await markEmailsReplyChecked(
    userId,
    emails.map((email) => email.id)
  );

  return {
    provider,
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
      message: "Something went wrong while checking for replies. Please try again.",
      retryable: false,
    },
  };
}
