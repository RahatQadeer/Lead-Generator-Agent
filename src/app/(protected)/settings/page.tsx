import { Settings } from "lucide-react";
import { IntegrationsHub } from "@/components/settings/IntegrationsHub";
import { OutreachHub } from "@/components/settings/OutreachHub";
import { ProfileSettingsCard } from "@/components/settings/ProfileSettingsCard";
import { SettingsSectionHeading } from "@/components/settings/SettingsSectionHeading";
import { PageHeader } from "@/components/layout/PageHeader";
import { getAuthContext } from "@/lib/auth/get-auth-context";

export default async function SettingsPage() {
  const { profile } = await getAuthContext();

  return (
    <>
      <PageHeader
        icon={Settings}
        title="Account settings"
        description="Manage your profile, integrations, and outreach preferences."
      />

      <div className="space-y-10">
        <section>
          <SettingsSectionHeading
            step={1}
            title="Profile"
            description="Upload your photo and display name — used in the app header and outreach emails."
          />
          <div className="mt-4 max-w-2xl">
            <ProfileSettingsCard profile={profile} />
          </div>
        </section>

        <section>
          <SettingsSectionHeading
            step={2}
            title="Integrations"
            description="Connect AI and email providers for outreach generation and delivery."
          />
          <div className="mt-4">
            <IntegrationsHub />
          </div>
        </section>

        <section>
          <SettingsSectionHeading
            step={3}
            title="Outreach"
            description="Configure how leads are scored and how outreach emails are composed."
          />
          <div className="mt-4">
            <OutreachHub />
          </div>
        </section>
      </div>
    </>
  );
}
