import type { ReplyDetector } from "@/lib/reply-tracking/types";
import type {
  DetectedReply,
  SentEmailForReplyCheck,
} from "@/types/reply-tracking";

function shouldMockReply(email: SentEmailForReplyCheck): boolean {
  const hash = email.id
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return hash % 3 === 0;
}

export class MockReplyDetector implements ReplyDetector {
  readonly name = "mock";

  async detectReplies(
    _userId: string,
    emails: SentEmailForReplyCheck[]
  ): Promise<DetectedReply[]> {
    await new Promise((r) => setTimeout(r, 300));

    return emails
      .filter(shouldMockReply)
      .map((email) => ({
        emailId: email.id,
        repliedAt: new Date().toISOString(),
        snippet: `Thanks for reaching out — happy to learn more about ${email.subject}.`,
        providerMessageId: `mock-reply-${email.id.slice(0, 8)}`,
      }));
  }
}
