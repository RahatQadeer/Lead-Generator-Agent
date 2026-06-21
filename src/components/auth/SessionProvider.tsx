"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isProtectedPath } from "@/lib/auth/routes";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const onProtectedRoute = isProtectedPath(pathname);

      if (
        onProtectedRoute &&
        (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session))
      ) {
        router.replace(
          `/login?error=session_expired&redirect=${encodeURIComponent(pathname)}`
        );
        return;
      }

      if (event === "TOKEN_REFRESHED" && session) {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  useEffect(() => {
    if (!isProtectedPath(pathname)) return;

    const supabase = createClient();

    async function verifySession() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!user) {
        const errorCode =
          error?.message?.toLowerCase().includes("expired") ||
          error?.message?.toLowerCase().includes("refresh")
            ? "session_expired"
            : "invalid_session";

        router.replace(
          `/login?error=${errorCode}&redirect=${encodeURIComponent(pathname)}`
        );
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") verifySession();
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pathname, router]);

  return <>{children}</>;
}
