import { Mail } from "lucide-react";
import { CheckRepliesPanel } from "@/components/emails/CheckRepliesPanel";
import { CampaignHistory } from "@/components/emails/CampaignHistory";
import { EmailDraftCard } from "@/components/emails/EmailDraftCard";
import { SendCampaignPanel } from "@/components/emails/SendCampaignPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import {
  getCampaignSummary,
  getOutreachCampaignsByUserId,
} from "@/lib/email-campaigns/queries";
import { getReplySummary } from "@/lib/reply-tracking/queries";
import { getConfiguredReplyTrackingProvider } from "@/lib/reply-tracking/factory";
import { getOutreachEmailsByUserId } from "@/lib/emails/queries";
import { getConfiguredEmailProviderName } from "@/lib/email-generation/factory";
import { getConfiguredSendingProviderName } from "@/lib/email-sending/factory";
import { createClient } from "@/lib/supabase/server";

export default async function EmailsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const emails = user ? await getOutreachEmailsByUserId(user.id) : [];
  const summary = user
    ? await getCampaignSummary(user.id)
    : { draftCount: 0, sentCount: 0, campaignCount: 0 };
  const campaigns = user ? await getOutreachCampaignsByUserId(user.id) : [];
  const replySummary = user
    ? await getReplySummary(user.id)
    : { sentCount: 0, repliedCount: 0, awaitingReplyCount: 0 };
  const generationProvider = getConfiguredEmailProviderName();
  const sendingProvider = getConfiguredSendingProviderName();
  const replyProvider = getConfiguredReplyTrackingProvider();

  return (
    <>
      <PageHeader
        icon={Mail}
        label="Emails"
        title="Outreach campaigns"
        description="Review AI-generated emails, launch batch campaigns, and track delivery status."
      />
      <p className="mb-4 text-xs text-slate-500">
        Generation: <span className="text-slate-300">{generationProvider}</span>
        {" · "}
        Sending: <span className="text-slate-300">{sendingProvider}</span>
        {" · "}
        Reply tracking: <span className="text-slate-300">{replyProvider}</span>
      </p>

      <CheckRepliesPanel summary={replySummary} />
      <SendCampaignPanel summary={summary} sendingProvider={sendingProvider} />
      <CampaignHistory campaigns={campaigns} />

      {emails.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No emails yet"
          description="Generate outreach emails from the Leads page after discovering and enriching contacts."
        />
      ) : (
        <div className="space-y-4">
          {emails.map((email) => (
            <EmailDraftCard
              key={email.id}
              email={email}
              sendingProvider={sendingProvider}
            />
          ))}
        </div>
      )}
    </>
  );
}
