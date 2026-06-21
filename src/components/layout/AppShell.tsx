"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Bell, Settings, Plus } from "lucide-react";
import { BrandMark } from "@/components/layout/BrandMark";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  btnPrimaryClassName,
  headerClassName,
  pageSurfaceClassName,
  sidebarClassName,
} from "@/lib/ui/styles";
import type { Profile } from "@/types/database";

interface AppShellProps {
  profile: Profile;
  children: React.ReactNode;
}

export function AppShell({ profile, children }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className={pageSurfaceClassName}>
      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden w-64 ${sidebarClassName} lg:flex`}
      >
        <SidebarBrand />
        <SidebarNav />
        <SidebarCreateSearch />
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-transform duration-300 lg:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarBrand />
        <SidebarNav
          showClose
          onClose={() => setMobileMenuOpen(false)}
          onNavigate={() => setMobileMenuOpen(false)}
        />
        <SidebarCreateSearch onNavigate={() => setMobileMenuOpen(false)} />
      </aside>

      <div className="lg:pl-64">
        <header className={headerClassName}>
          <div className="flex h-[4.25rem] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-xl p-2 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-ink)] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
              <ThemeToggle />
              <button
                type="button"
                className="rounded-xl p-2.5 text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-ink-secondary)]"
                aria-label="Notifications"
              >
                <Bell className="h-[1.125rem] w-[1.125rem]" />
              </button>
              <Link
                href="/settings"
                className="rounded-xl p-2.5 text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-ink-secondary)]"
                aria-label="Settings"
              >
                <Settings className="h-[1.125rem] w-[1.125rem]" />
              </Link>
              <div className="mx-1 hidden h-6 w-px bg-[var(--color-border)] sm:block" />
              <ProfileMenu profile={profile} />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarCreateSearch({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="mt-auto shrink-0 border-t border-[var(--color-border)] p-4">
      <Link
        href="/searches"
        onClick={onNavigate}
        className={`${btnPrimaryClassName} w-full`}
      >
        <Plus className="h-4 w-4" />
        Create search
      </Link>
    </div>
  );
}

function SidebarBrand() {
  return (
    <div className="flex h-[4.25rem] shrink-0 items-center border-b border-[var(--color-border)] px-5">
      <BrandMark href="/dashboard" />
    </div>
  );
}
