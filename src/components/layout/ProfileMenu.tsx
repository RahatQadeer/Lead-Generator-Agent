"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LogOut, Mail } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { getProfileDisplayName, getProfileInitials } from "@/lib/profile/initials";
import { createClient } from "@/lib/supabase/client";
import { profilePopoverClassName } from "@/lib/ui/styles";
import type { Profile } from "@/types/database";

interface ProfileMenuProps {
  profile: Profile;
}

export function ProfileMenu({ profile }: ProfileMenuProps) {
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const displayName = getProfileDisplayName(profile);
  const initials = getProfileInitials(profile);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        className={`rounded-full p-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-accent-600)_25%,transparent)] ${
          open
            ? "bg-[var(--color-surface-elevated)] ring-2 ring-[var(--color-border)]"
            : "hover:bg-[var(--color-surface-elevated)]"
        }`}
        aria-label="Open account menu"
      >
        <UserAvatar
          email={profile.email}
          fullName={profile.full_name}
          avatarUrl={profile.avatar_url}
          size="sm"
          ringClassName="ring-2 ring-white"
        />
        <span className="sr-only">{displayName}</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className={`${profilePopoverClassName} animate-popover-in`}
        >
          <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-4">
            <div className="flex items-center gap-3">
              <UserAvatar
                email={profile.email}
                fullName={profile.full_name}
                avatarUrl={profile.avatar_url}
                size="lg"
                ringClassName="ring-2 ring-[var(--color-surface)]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                  {displayName}
                </p>
                <div className="mt-1.5 flex items-start gap-1.5">
                  <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-ink-muted)]" />
                  <p
                    className="min-w-0 break-words text-xs leading-relaxed text-[var(--color-ink-secondary)]"
                    title={profile.email}
                  >
                    {profile.email}
                  </p>
                </div>
                {!profile.avatar_url && (
                  <p className="mt-1 text-[10px] text-[var(--color-ink-muted)]">
                    Initials: {initials}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="p-2">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink-secondary)] shadow-sm transition-all hover:border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut className="h-4 w-4 text-[var(--color-ink-muted)]" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
