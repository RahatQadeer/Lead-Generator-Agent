import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildOutlookAuthorizeUrl } from "@/lib/outlook/oauth";
import { createClient } from "@/lib/supabase/route-handler";

const STATE_COOKIE = "outlook_oauth_state";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const redirectTo = searchParams.get("redirect") ?? "/settings";
  const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/settings";

  const response = NextResponse.redirect(`${origin}${safeRedirect}`);
  const supabase = createClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "login_required");
    loginUrl.searchParams.set("redirect", safeRedirect);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const state = randomBytes(24).toString("hex");
    const authorizeUrl = buildOutlookAuthorizeUrl({ origin, state });

    const outlookRedirect = NextResponse.redirect(authorizeUrl);
    outlookRedirect.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    outlookRedirect.cookies.set("outlook_oauth_redirect", safeRedirect, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return outlookRedirect;
  } catch (error) {
    const settingsUrl = new URL(safeRedirect, origin);
    settingsUrl.searchParams.set(
      "outlook_error",
      error instanceof Error ? error.message : "outlook_auth_failed"
    );
    return NextResponse.redirect(settingsUrl);
  }
}
