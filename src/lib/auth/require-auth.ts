import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { classifyAuthError } from "@/lib/auth/session";

export async function requireAuth(redirectPath = "/dashboard"): Promise<User> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user) {
    const errorCode = error ? classifyAuthError(error) : "login_required";
    redirect(
      `/login?error=${errorCode}&redirect=${encodeURIComponent(redirectPath)}`
    );
  }

  return user;
}
