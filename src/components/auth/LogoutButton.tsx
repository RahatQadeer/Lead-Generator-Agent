"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { btnSecondaryClassName } from "@/lib/ui/styles";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={`${btnSecondaryClassName} !min-h-0 !px-3 !py-2`}
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">
        {loading ? "Signing out…" : "Sign out"}
      </span>
    </button>
  );
}
