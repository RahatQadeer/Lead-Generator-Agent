import { Mail } from "lucide-react";
import { CheckRepliesPanel } from "@/components/emails/CheckRepliesPanel";
import { EmailCampaignActions } from "@/components/emails/EmailCampaignActions";
import { EmailCampaignStats } from "@/components/emails/EmailCampaignStats";
import { FollowUpQueueList } from "@/components/emails/FollowUpQueueList";
import { FollowUpsPanel } from "@/components/emails/FollowUpsPanel";
import { CampaignHistory } from "@/components/emails/CampaignHistory";
import { EmailDraftsSection } from "@/components/emails/EmailDraftsSection";
import { SendCampaignPanel } from "@/components/emails/SendCampaignPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { cardClassName } from "@/lib/ui/styles";
import {
  getCampaignSummary,
  getOutreachCampaignsByUserId,
} from "@/lib/email-campaigns/queries";
import {
  getFollowUpSummary,
  getScheduledFollowUpsWithContext,
} from "@/lib/follow-ups/queries";
import { getReplySummary } from "@/lib/reply-tracking/queries";
import { resolveReplyTrackingProvider } from "@/lib/reply-tracking/resolve-provider";
import { getOutreachEmailsByUserId } from "@/lib/emails/queries";
import { resolveEmailGenerationConfig } from "@/lib/openai/settings";
import { resolveSendingProvider } from "@/lib/email-sending/resolve-provider";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { toSenderProfile } from "@/lib/profile/initials";

export default async function EmailsPage() {
  const { user, profile } = await getAuthContext();
  const sender = toSenderProfile(profile);

  const emails = await getOutreachEmailsByUserId(user.id);
  const summary = await getCampaignSummary(user.id);
  const campaigns = await getOutreachCampaignsByUserId(user.id);
  const replySummary = await getReplySummary(user.id);
  const followUpSummary = await getFollowUpSummary(user.id);
  const scheduledFollowUps = await getScheduledFollowUpsWithContext(user.id);
  const generationConfig = await resolveEmailGenerationConfig(user.id);
  const generationProvider = generationConfig.provider;
  const sendingProvider = await resolveSendingProvider(user.id);
  const replyProvider = await resolveReplyTrackingProvider(user.id);

  const hasAnyActivity =
    emails.length > 0 ||
    summary.sentCount > 0 ||
    summary.draftCount > 0 ||
    campaigns.length > 0;

  return (
    <>
      <PageHeader
        icon={Mail}
        title="Outreach campaigns"
        description="Review AI-generated emails, launch batch campaigns, and track delivery status."
      />

      <p className="-mt-4 mb-6 text-xs text-gray-400">
        Generation {generationProvider} · Sending {sendingProvider} · Reply
        tracking {replyProvider}
      </p>

      <div className="space-y-6">
        {hasAnyActivity && (
          <>
            <EmailCampaignStats summary={summary} replySummary={replySummary} />
            <EmailCampaignActions
              summary={summary}
              replySummary={replySummary}
              sendingProvider={sendingProvider}
              replyProvider={replyProvider}
            />
            <FollowUpsPanel summary={followUpSummary} />
          </>
        )}

        {!hasAnyActivity && (
          <div className={`${cardClassName} p-5 sm:p-6`}>
            <SendCampaignPanel
              summary={summary}
              sendingProvider={sendingProvider}
            />
            {replySummary.sentCount > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <CheckRepliesPanel
                  summary={replySummary}
                  replyProvider={replyProvider}
                  autoCheck
                />
              </div>
            )}
          </div>
        )}

        <EmailDraftsSection
          emails={emails}
          sendingProvider={sendingProvider}
          sender={sender}
        />

        {campaigns.length > 0 && (
          <SectionCard
            title="Campaign history"
            padContent={false}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 p-5 sm:p-6">
              <CampaignHistory campaigns={campaigns} />
            </div>
          </SectionCard>
        )}

        {scheduledFollowUps.length > 0 && (
          <SectionCard
            title="Follow-up queue"
            padContent={false}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 p-5 sm:p-6">
              <FollowUpQueueList followUps={scheduledFollowUps} />
            </div>
          </SectionCard>
        )}
      </div>
    </>
  );
}
