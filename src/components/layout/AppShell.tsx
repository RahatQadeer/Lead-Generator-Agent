"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Menu,
  Search,
  Bell,
  Settings,
  LayoutGrid,
  Plus,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { inputClassName } from "@/components/ui/Field";
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

  const initials = profile.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : profile.email[0]?.toUpperCase() ?? "U";

  return (
    <div className={pageSurfaceClassName}>
      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-gray-900/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden w-64 ${sidebarClassName} lg:flex`}
      >
        <SidebarBrand />
        <SidebarNav />
        <div className="mt-auto border-t border-gray-200 p-4">
          <Link href="/searches" className={`${btnPrimaryClassName} w-full`}>
            <Plus className="h-4 w-4" />
            Create search
          </Link>
        </div>
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-gray-200 bg-white transition-transform duration-300 lg:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarBrand />
        <SidebarNav
          showClose
          onClose={() => setMobileMenuOpen(false)}
          onNavigate={() => setMobileMenuOpen(false)}
        />
        <div className="mt-auto border-t border-gray-200 p-4">
          <Link
            href="/searches"
            onClick={() => setMobileMenuOpen(false)}
            className={`${btnPrimaryClassName} w-full`}
          >
            <Plus className="h-4 w-4" />
            Create search
          </Link>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className={headerClassName}>
          <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden min-w-0 flex-1 md:block md:max-w-xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search campaigns, leads, or companies…"
                  className={`${inputClassName} rounded-full pl-10`}
                  aria-label="Global search"
                />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="hidden rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 sm:inline-flex"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </button>
              <Link
                href="/settings"
                className="hidden rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 sm:inline-flex"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </Link>

              <div className="hidden h-8 w-px bg-gray-200 sm:block" />

              <div className="flex items-center gap-3">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name ?? "User"}
                    className="h-9 w-9 rounded-full ring-2 ring-gray-100"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {initials}
                  </div>
                )}
                <div className="hidden text-right lg:block">
                  <p className="text-sm font-medium text-gray-900">
                    {profile.full_name ?? "User"}
                  </p>
                  <p className="max-w-[180px] truncate text-xs text-gray-500">
                    {profile.email}
                  </p>
                </div>
              </div>
              <LogoutButton />
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

function SidebarBrand() {
  return (
    <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 shadow-sm">
        <LayoutGrid className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">LeadForge</p>
        <p className="truncate text-xs text-gray-500">Revenue Operations</p>
      </div>
    </div>
  );
}
