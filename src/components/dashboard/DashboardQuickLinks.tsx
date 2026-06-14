import { LayoutGrid, Mail, Search, Users } from "lucide-react";
import { DashboardPanelShell } from "@/components/dashboard/DashboardPanelShell";
import {
  QuickLinkGrid,
  type QuickLinkItem,
} from "@/components/dashboard/QuickLinkGrid";

const LINKS: QuickLinkItem[] = [
  {
    href: "/searches",
    label: "Searches",
    description: "Run company discovery",
    icon: Search,
    accent: "violet",
  },
  {
    href: "/leads",
    label: "Leads",
    description: "Enrich & score contacts",
    icon: Users,
    accent: "sky",
  },
  {
    href: "/emails",
    label: "Emails",
    description: "Outreach & campaigns",
    icon: Mail,
    accent: "emerald",
  },
];

export function DashboardQuickLinks() {
  return (
    <DashboardPanelShell icon={LayoutGrid} title="Quick links">
      <QuickLinkGrid links={LINKS} />
    </DashboardPanelShell>
  );
}
