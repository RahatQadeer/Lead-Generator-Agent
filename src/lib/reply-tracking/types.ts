import type {
  DetectedReply,
  SentEmailForReplyCheck,
} from "@/types/reply-tracking";

export interface ReplyDetector {
  readonly name: string;
  detectReplies(
    userId: string,
    emails: SentEmailForReplyCheck[]
  ): Promise<DetectedReply[]>;
}
