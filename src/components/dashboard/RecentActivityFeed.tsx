"use client";

import Link from "next/link";
import {
  Activity,
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
import { ActivityFeedItem } from "@/components/dashboard/ActivityFeedItem";
import { DashboardPanelShell } from "@/components/dashboard/DashboardPanelShell";
import { linkClassName, textSecondaryClassName } from "@/lib/ui/styles";
import type { ActivityItem, ActivityType } from "@/types/dashboard";
import type { LucideIcon } from "lucide-react";

const VISIBLE_ITEM_COUNT = 6;

/** ~5.25rem per card + 0.5rem gap between items */
const SCROLL_MAX_HEIGHT = `calc(${VISIBLE_ITEM_COUNT} * 5.25rem + ${VISIBLE_ITEM_COUNT - 1} * 0.5rem)`;

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

export function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  return (
    <DashboardPanelShell icon={Activity} title="Recent activity">
      {activities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-5 py-10 text-center">
          <p className="text-sm font-medium text-gray-700">No activity yet</p>
          <p className={`mt-1.5 ${textSecondaryClassName}`}>
            Create a search to start building your timeline.
          </p>
          <Link href="/searches" className={`mt-4 ${linkClassName}`}>
            Go to searches
          </Link>
        </div>
      ) : (
        <ul
          className="activity-feed-scroll space-y-2 overflow-y-auto overscroll-y-contain pr-1.5"
          style={{ maxHeight: SCROLL_MAX_HEIGHT }}
        >
          {activities.map((activity) => {
            const Icon = activityIcons[activity.type];

            return (
              <li key={activity.id}>
                <ActivityFeedItem activity={activity} icon={Icon} />
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPanelShell>
  );
}
