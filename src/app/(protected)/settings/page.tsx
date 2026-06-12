import { Settings } from "lucide-react";
import { EmailTemplatesSettingsCard } from "@/components/settings/EmailTemplatesSettingsCard";
import { GmailSettingsCard } from "@/components/settings/GmailSettingsCard";
import { OpenAISettingsCard } from "@/components/settings/OpenAISettingsCard";
import { LeadScoringSettingsCard } from "@/components/settings/LeadScoringSettingsCard";
import { OutlookSettingsCard } from "@/components/settings/OutlookSettingsCard";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { PageHeader } from "@/components/layout/PageHeader";
import { cardClassName, cardPaddingClassName } from "@/lib/ui/styles";

export default async function SettingsPage() {
  const { profile } = await getAuthContext();

  return (
    <>
      <PageHeader
        icon={Settings}
        label="Settings"
        title="Account settings"
        description="Manage your profile and platform preferences."
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <OpenAISettingsCard />
        <GmailSettingsCard />
        <OutlookSettingsCard />
        <LeadScoringSettingsCard />
        <EmailTemplatesSettingsCard />
      </div>

      <div className={`${cardClassName} ${cardPaddingClassName} max-w-xl`}>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Profile
        </h2>
        <dl className="mt-6 space-y-5">
          <div>
            <dt className="text-xs font-medium text-gray-500">Full name</dt>
            <dd className="mt-1 break-words text-sm text-gray-900">
              {profile.full_name ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Email</dt>
            <dd className="mt-1 break-all text-sm text-gray-900">
              {profile.email}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Member since</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(profile.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </div>
    </>
  );
}
