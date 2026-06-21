import type { OutreachCampaign } from "@/types/email-campaign";
import { getSendingProviderLabel } from "@/lib/email-sending/factory";

interface CampaignHistoryProps {
  campaigns: OutreachCampaign[];
}

function statusColor(status: OutreachCampaign["status"]): string {
  switch (status) {
    case "completed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "partial":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "failed":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }
}

export function CampaignHistory({ campaigns }: CampaignHistoryProps) {
  if (campaigns.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
        Recent campaigns
      </h2>
      <ul className="space-y-2">
        {campaigns.map((campaign) => (
          <li
            key={campaign.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{campaign.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {getSendingProviderLabel(campaign.provider)}
                {" · "}
                {campaign.sentCount}/{campaign.totalCount} sent
                {campaign.failedCount > 0
                  ? ` · ${campaign.failedCount} failed`
                  : ""}
              </p>
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs capitalize ${statusColor(campaign.status)}`}
            >
              {campaign.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
