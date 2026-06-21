import Link from "next/link";
import {
  Ban,
  Mail,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  Star,
  UserPlus,
  Users,
} from "lucide-react";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { formatRelativeTime } from "@/lib/dashboard/format";
import { getActivityTypeLabel } from "@/lib/dashboard/activity-feed";
import type { ActivityItem, ActivityType } from "@/types/dashboard";
import type { LucideIcon } from "lucide-react";

interface RecentActivityFeedProps {
  activities: ActivityItem[];
}

const activityIcons: Record<ActivityType, LucideIcon> = {
  search_created: Search,
  lead_discovered: UserPlus,
  lead_enriched: Users,
  lead_scored: Star,
  email_generated: Sparkles,
  email_sent: Send,
  email_replied: MessageSquare,
  campaign_completed: Mail,
  follow_up_scheduled: Mail,
  follow_up_cancelled: Ban,
  follow_up_suggested: Sparkles,
};

const activityColors: Record<ActivityType, string> = {
  search_created: "bg-cyan-500/10 text-cyan-400",
  lead_discovered: "bg-violet-500/10 text-violet-400",
  lead_enriched: "bg-violet-500/10 text-violet-400",
  lead_scored: "bg-amber-500/10 text-amber-400",
  email_generated: "bg-sky-500/10 text-sky-400",
  email_sent: "bg-cyan-500/10 text-cyan-400",
  email_replied: "bg-emerald-500/10 text-emerald-400",
  campaign_completed: "bg-cyan-500/10 text-cyan-400",
  follow_up_scheduled: "bg-amber-500/10 text-amber-400",
  follow_up_cancelled: "bg-rose-500/10 text-rose-400",
  follow_up_suggested: "bg-violet-500/10 text-violet-400",
};

export function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  return (
    <DashboardSection
      title="Recent activity"
      description="Latest actions across searches, leads, and outreach."
    >
      {activities.length === 0 ? (
        <p className="text-sm text-slate-500">
          No activity yet. Create a search to get started.
        </p>
      ) : (
        <ul className="space-y-3">
          {activities.map((activity) => {
            const Icon = activityIcons[activity.type];
            const colorClass = activityColors[activity.type];

            return (
              <li key={activity.id}>
                <Link
                  href={activity.href}
                  className="group flex gap-3 rounded-xl border border-white/5 bg-slate-950/40 p-3 transition-colors hover:border-white/10 hover:bg-white/5"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-white group-hover:text-cyan-100">
                        {activity.title}
                      </p>
                      <span className="shrink-0 text-xs text-slate-600">
                        {formatRelativeTime(activity.timestamp)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {activity.description}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-600">
                      {getActivityTypeLabel(activity.type)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardSection>
  );
}
