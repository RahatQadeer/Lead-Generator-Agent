import { NextResponse, type NextRequest } from "next/server";
import { upsertProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/route-handler";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/dashboard";

  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set(
      "error",
      errorDescription ?? error ?? "auth_failed"
    );
    loginUrl.searchParams.set("redirect", safeRedirect);
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "missing_auth_code");
    loginUrl.searchParams.set("redirect", safeRedirect);
    return NextResponse.redirect(loginUrl);
  }

  const redirectResponse = NextResponse.redirect(`${origin}${safeRedirect}`);
  const supabase = createClient(request, redirectResponse);

  const { data, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set(
      "error",
      exchangeError?.message ?? "session_creation_failed"
    );
    loginUrl.searchParams.set("redirect", safeRedirect);
    return NextResponse.redirect(loginUrl);
  }

  await upsertProfile(supabase, data.user);

  return redirectResponse;
}
