"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Users,
  Mail,
  BarChart3,
  Settings,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/searches", label: "Searches", icon: Search },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/emails", label: "Emails", icon: Mail },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarNavProps {
  onNavigate?: () => void;
  showClose?: boolean;
  onClose?: () => void;
}

export function SidebarNav({
  onNavigate,
  showClose,
  onClose,
}: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 p-4">
      {showClose && (
        <div className="mb-2 flex items-center justify-between lg:hidden">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/20"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${isActive ? "text-cyan-400" : ""}`}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
