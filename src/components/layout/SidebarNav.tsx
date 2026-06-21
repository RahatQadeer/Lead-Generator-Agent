"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Users,
  Mail,
  Settings,
  X,
} from "lucide-react";
import {
  headingSubsectionClassName,
  navLinkActiveClassName,
  navLinkInactiveClassName,
} from "@/lib/ui/styles";
import type { LucideIcon } from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/searches", label: "Searches", icon: Search },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/emails", label: "Emails", icon: Mail },
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
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-4">
      {showClose && (
        <div className="mb-2 flex items-center justify-between lg:hidden">
          <span className={headingSubsectionClassName}>Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-ink)]"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      <p className={`mb-2 px-3.5 ${headingSubsectionClassName}`}>Menu</p>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={
              isActive ? navLinkActiveClassName : navLinkInactiveClassName
            }
          >
            <Icon
              className={`h-[1.125rem] w-[1.125rem] shrink-0 ${
                isActive ? "text-[var(--color-accent-600)]" : "text-[var(--color-ink-muted)]"
              }`}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
