import { Settings } from "lucide-react";
import { LeadScoringSettingsCard } from "@/components/settings/LeadScoringSettingsCard";
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
        description="Manage your profile and how discovered leads are scored."
      />

      <div className="space-y-10">
        <section>
          <SettingsSectionHeading
            step={1}
            title="Profile"
            description="Upload your photo and display name — used in the app header."
          />
          <div className="mt-4 max-w-2xl">
            <ProfileSettingsCard profile={profile} />
          </div>
        </section>

        <section>
          <SettingsSectionHeading
            step={2}
            title="Lead scoring"
            description="Tune how industry, size, location, role, and tech signals combine into each lead score."
          />
          <div className="mt-4">
            <LeadScoringSettingsCard />
          </div>
        </section>
      </div>
    </>
  );
}
