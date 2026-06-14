"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { btnSecondaryClassName } from "@/lib/ui/styles";

interface LogoutButtonProps {
  variant?: "header" | "sidebar";
  className?: string;
  onLogout?: () => void;
}

export function LogoutButton({
  variant = "header",
  className = "",
  onLogout,
}: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    onLogout?.();
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 ${className}`.trim()}
      >
        <LogOut className="h-[1.125rem] w-[1.125rem] shrink-0" />
        {loading ? "Signing out…" : "Sign out"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={`${btnSecondaryClassName} !min-h-0 !px-3 !py-2 ${className}`.trim()}
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">
        {loading ? "Signing out…" : "Sign out"}
      </span>
    </button>
  );
}
