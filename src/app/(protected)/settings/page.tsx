import { Settings } from "lucide-react";
import { GmailConnectionCard } from "@/components/settings/GmailConnectionCard";
import { OutlookConnectionCard } from "@/components/settings/OutlookConnectionCard";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { PageHeader } from "@/components/layout/PageHeader";

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
        <GmailConnectionCard />
        <OutlookConnectionCard />
      </div>

      <div className="max-w-xl rounded-2xl border border-white/5 bg-slate-900/50 p-6 sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Profile
        </h2>
        <dl className="mt-6 space-y-5">
          <div>
            <dt className="text-xs font-medium text-slate-500">Full name</dt>
            <dd className="mt-1 text-sm text-white">
              {profile.full_name ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Email</dt>
            <dd className="mt-1 text-sm text-white">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Member since</dt>
            <dd className="mt-1 text-sm text-white">
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
