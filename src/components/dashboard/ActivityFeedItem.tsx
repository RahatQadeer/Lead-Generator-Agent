import Link from "next/link";
import { formatRelativeTime } from "@/lib/dashboard/format";
import { getActivityTypeLabel } from "@/lib/dashboard/activity-labels";
import type { ActivityItem, ActivityType } from "@/types/dashboard";
import type { LucideIcon } from "lucide-react";

const activityStyles: Record<
  ActivityType,
  { accent: string; icon: string; badge: string }
> = {
  search_created: {
    accent: "border-l-violet-400",
    icon: "bg-violet-50 text-violet-600",
    badge: "bg-violet-50 text-violet-700",
  },
  lead_discovered: {
    accent: "border-l-violet-400",
    icon: "bg-violet-50 text-violet-600",
    badge: "bg-violet-50 text-violet-700",
  },
  lead_enriched: {
    accent: "border-l-violet-400",
    icon: "bg-violet-50 text-violet-600",
    badge: "bg-violet-50 text-violet-700",
  },
  lead_scored: {
    accent: "border-l-amber-400",
    icon: "bg-amber-50 text-amber-600",
    badge: "bg-amber-50 text-amber-700",
  },
  email_generated: {
    accent: "border-l-sky-400",
    icon: "bg-sky-50 text-sky-600",
    badge: "bg-sky-50 text-sky-700",
  },
  email_sent: {
    accent: "border-l-gray-300",
    icon: "bg-gray-100 text-gray-600",
    badge: "bg-gray-100 text-gray-600",
  },
  email_replied: {
    accent: "border-l-emerald-400",
    icon: "bg-emerald-50 text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700",
  },
  campaign_completed: {
    accent: "border-l-gray-300",
    icon: "bg-gray-100 text-gray-600",
    badge: "bg-gray-100 text-gray-600",
  },
  follow_up_scheduled: {
    accent: "border-l-amber-400",
    icon: "bg-amber-50 text-amber-600",
    badge: "bg-amber-50 text-amber-700",
  },
  follow_up_cancelled: {
    accent: "border-l-red-300",
    icon: "bg-red-50 text-red-500",
    badge: "bg-red-50 text-red-600",
  },
  follow_up_suggested: {
    accent: "border-l-violet-400",
    icon: "bg-violet-50 text-violet-600",
    badge: "bg-violet-50 text-violet-700",
  },
};

interface ActivityFeedItemProps {
  activity: ActivityItem;
  icon: LucideIcon;
}

export function ActivityFeedItem({ activity, icon: Icon }: ActivityFeedItemProps) {
  const styles = activityStyles[activity.type];
  const typeLabel = getActivityTypeLabel(activity.type);

  return (
    <Link
      href={activity.href}
      className={`group flex gap-2.5 rounded-xl border border-gray-100 border-l-[3px] bg-white py-2.5 pl-2.5 pr-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-[border-color,box-shadow] duration-200 hover:border-gray-200 hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)] ${styles.accent}`}
    >
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-snug text-gray-900 group-hover:text-violet-900">
          {activity.title}
        </p>
        {activity.description && (
          <p className="mt-0.5 truncate text-xs leading-snug text-gray-500">
            {activity.description}
          </p>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium tabular-nums text-gray-400">
            {formatRelativeTime(activity.timestamp)}
          </span>
          <span
            className={`shrink-0 rounded-md px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${styles.badge}`}
          >
            {typeLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
