import { CheckRepliesPanel } from "@/components/emails/CheckRepliesPanel";
import { SendCampaignPanel } from "@/components/emails/SendCampaignPanel";
import { cardClassName } from "@/lib/ui/styles";
import type { CampaignSummary } from "@/types/email-campaign";
import type { EmailSendingProviderName } from "@/types/email-sending";
import type { ReplyTrackingProviderName } from "@/lib/reply-tracking/factory";
import type { ReplySummary } from "@/types/reply-tracking";

interface EmailCampaignActionsProps {
  summary: CampaignSummary;
  replySummary: ReplySummary;
  sendingProvider: EmailSendingProviderName;
  replyProvider: ReplyTrackingProviderName;
}

export function EmailCampaignActions({
  summary,
  replySummary,
  sendingProvider,
  replyProvider,
}: EmailCampaignActionsProps) {
  const showReplies = replySummary.sentCount > 0;
  const showSend =
    summary.draftCount > 0 || summary.sentCount > 0;

  if (!showReplies && !showSend) return null;

  return (
    <div
      className={`${cardClassName} grid gap-6 p-5 sm:p-6 ${
        showSend && showReplies ? "sm:grid-cols-2" : ""
      }`}
    >
      {showSend && (
        <SendCampaignPanel
          summary={summary}
          sendingProvider={sendingProvider}
        />
      )}
      {showReplies && (
        <CheckRepliesPanel
          summary={replySummary}
          replyProvider={replyProvider}
          autoCheck
        />
      )}
    </div>
  );
}
