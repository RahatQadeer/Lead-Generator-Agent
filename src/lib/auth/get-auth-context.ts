import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { classifyAuthError } from "@/lib/auth/session";
import type { Profile } from "@/types/database";

type AuthContext = {
  user: User;
  profile: Profile;
};

async function fetchAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "/dashboard";
    const errorCode = error ? classifyAuthError(error) : "login_required";
    redirect(
      `/login?error=${errorCode}&redirect=${encodeURIComponent(pathname)}`
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const displayProfile: Profile = profile ?? {
    id: user.id,
    email: user.email ?? "",
    full_name:
      user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    created_at: user.created_at,
    updated_at: new Date().toISOString(),
  };

  return { user, profile: displayProfile };
}

export const getAuthContext = cache(fetchAuthContext);
