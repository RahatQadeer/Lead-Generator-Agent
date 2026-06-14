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
        className={`rounded-full p-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 ${
          open
            ? "bg-gray-100 ring-2 ring-gray-200"
            : "hover:bg-gray-100/80"
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
          <div className="border-b border-gray-100 bg-gradient-to-b from-gray-50/90 to-white px-4 py-4">
            <div className="flex items-center gap-3">
              <UserAvatar
                email={profile.email}
                fullName={profile.full_name}
                avatarUrl={profile.avatar_url}
                size="lg"
                ringClassName="ring-2 ring-white"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] font-semibold tracking-[-0.02em] text-gray-950">
                  {displayName}
                </p>
                <div className="mt-1.5 flex items-start gap-1.5">
                  <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <p
                    className="min-w-0 break-words text-xs leading-relaxed text-gray-500"
                    title={profile.email}
                  >
                    {profile.email}
                  </p>
                </div>
                {!profile.avatar_url && (
                  <p className="mt-1 text-[10px] text-gray-400">
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
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut className="h-4 w-4 text-gray-400" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
