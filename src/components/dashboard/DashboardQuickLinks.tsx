import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Mail,
  Search,
  Users,
} from "lucide-react";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

const LINKS = [
  {
    href: "/searches",
    label: "Searches",
    description: "Define and run company discovery",
    icon: Search,
  },
  {
    href: "/leads",
    label: "Leads",
    description: "Enrich and score decision-makers",
    icon: Users,
  },
  {
    href: "/emails",
    label: "Emails",
    description: "Generate and send outreach",
    icon: Mail,
  },
  {
    href: "/analytics",
    label: "Analytics",
    description: "Track performance over time",
    icon: BarChart3,
  },
] as const;

export function DashboardQuickLinks() {
  return (
    <DashboardSection title="Quick links" description="Jump to a workflow.">
      <ul className="space-y-2">
        {LINKS.map(({ href, label, description, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex items-center gap-3 rounded-xl border border-white/5 bg-slate-950/40 px-4 py-3 transition-colors hover:border-white/10 hover:bg-white/5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5">
                <Icon className="h-4 w-4 text-slate-400 group-hover:text-cyan-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-xs text-slate-500">{description}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </DashboardSection>
  );
}
