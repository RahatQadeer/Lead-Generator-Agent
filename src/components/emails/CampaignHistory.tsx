import type { OutreachCampaign } from "@/types/email-campaign";
import { getSendingProviderLabel } from "@/lib/email-sending/factory";
import { listItemClassName, textSecondaryClassName } from "@/lib/ui/styles";

interface CampaignHistoryProps {
  campaigns: OutreachCampaign[];
}

function statusColor(status: OutreachCampaign["status"]): string {
  switch (status) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "failed":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-600";
  }
}

export function CampaignHistory({ campaigns }: CampaignHistoryProps) {
  if (campaigns.length === 0) return null;

  return (
    <ul className="space-y-2">
      {campaigns.map((campaign) => (
        <li key={campaign.id} className={listItemClassName}>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-medium text-gray-900">
              {campaign.name}
            </p>
            <p className={`mt-0.5 ${textSecondaryClassName}`}>
              {getSendingProviderLabel(campaign.provider)}
              {" · "}
              {campaign.sentCount}/{campaign.totalCount} sent
              {campaign.failedCount > 0
                ? ` · ${campaign.failedCount} failed`
                : ""}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs capitalize ${statusColor(campaign.status)}`}
          >
            {campaign.status}
          </span>
        </li>
      ))}
    </ul>
  );
}
