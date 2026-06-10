import { LogoutButton } from "@/components/auth/LogoutButton";
import { Sparkles, LayoutDashboard } from "lucide-react";
import type { Profile } from "@/types/database";

interface DashboardShellProps {
  profile: Profile | null;
  children: React.ReactNode;
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : profile?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">LeadForge</p>
              <p className="hidden text-xs text-slate-500 sm:block">AI Sales Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden items-center gap-3 sm:flex">
              {profile?.avatar_url ? (
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
              <div className="text-right">
                <p className="text-sm font-medium text-white">
                  {profile?.full_name ?? "User"}
                </p>
                <p className="text-xs text-slate-500">{profile?.email}</p>
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
  );
}

export function DashboardWelcome({ profile }: { profile: Profile | null }) {
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 text-cyan-400">
        <LayoutDashboard className="h-5 w-5" />
        <span className="text-sm font-medium">Dashboard</span>
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Welcome back, {firstName}
      </h1>
      <p className="mt-2 max-w-xl text-slate-400">
        Your AI-powered sales assistant is ready. Start discovering leads and
        automating outreach from here.
      </p>
    </div>
  );
}
