import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertProfile } from "@/lib/auth/profile";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set(
      "error",
      errorDescription ?? error ?? "auth_failed"
    );
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "missing_auth_code");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { data, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set(
      "error",
      exchangeError?.message ?? "session_creation_failed"
    );
    return NextResponse.redirect(loginUrl);
  }

  await upsertProfile(supabase, data.user);

  const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/dashboard";
  return NextResponse.redirect(`${origin}${safeRedirect}`);
}
