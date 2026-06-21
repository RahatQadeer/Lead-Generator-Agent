import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/route-handler";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/dashboard";

  // Placeholder response — URL replaced after OAuth URL is generated
  const response = NextResponse.redirect(`${origin}/login`);
  const supabase = createClient(request, response);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(safeRedirect)}`,
      scopes:
        "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email",
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", error?.message ?? "auth_failed");
    loginUrl.searchParams.set("redirect", safeRedirect);
    const errorResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => {
      errorResponse.cookies.set(cookie);
    });
    return errorResponse;
  }

  const googleRedirect = NextResponse.redirect(data.url);
  response.cookies.getAll().forEach((cookie) => {
    googleRedirect.cookies.set(cookie);
  });
  return googleRedirect;
}
