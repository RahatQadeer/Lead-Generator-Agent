"use client";

import { useState } from "react";
import { Menu, Sparkles } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { SidebarNav } from "@/components/layout/SidebarNav";
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
    <div className="min-h-screen bg-slate-950">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-white/5 bg-slate-900/50 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">LeadForge</p>
            <p className="text-xs text-slate-500">AI Sales Assistant</p>
          </div>
        </div>
        <SidebarNav />
      </aside>

      {/* Sidebar — mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/5 bg-slate-900 backdrop-blur-xl transition-transform duration-300 lg:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">LeadForge</p>
            <p className="text-xs text-slate-500">AI Sales Assistant</p>
          </div>
        </div>
        <SidebarNav
          showClose
          onClose={() => setMobileMenuOpen(false)}
          onNavigate={() => setMobileMenuOpen(false)}
        />
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex flex-1 items-center justify-end gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name ?? "User"}
                    className="h-8 w-8 rounded-full ring-2 ring-white/10"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-bold text-white">
                    {initials}
                  </div>
                )}
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium text-white">
                    {profile.full_name ?? "User"}
                  </p>
                  <p className="text-xs text-slate-500">{profile.email}</p>
                </div>
              </div>
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
