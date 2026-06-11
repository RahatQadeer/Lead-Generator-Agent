import { Mail } from "lucide-react";
import { EmailDraftCard } from "@/components/emails/EmailDraftCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
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
  const generationProvider = getConfiguredEmailProviderName();
  const sendingProvider = getConfiguredSendingProviderName();

  return (
    <>
      <PageHeader
        icon={Mail}
        label="Emails"
        title="Outreach campaigns"
        description="Review AI-generated emails, edit before sending, and track delivery status."
      />
      <p className="mb-4 text-xs text-slate-500">
        Generation: <span className="text-slate-300">{generationProvider}</span>
        {" · "}
        Sending: <span className="text-slate-300">{sendingProvider}</span>
      </p>
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
