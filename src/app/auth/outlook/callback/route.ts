import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeOutlookAuthCode,
  fetchOutlookProfileEmail,
} from "@/lib/outlook/oauth";
import { saveOutlookConnection } from "@/lib/outlook/connection";
import { createClient } from "@/lib/supabase/route-handler";

const STATE_COOKIE = "outlook_oauth_state";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const state = searchParams.get("state");
  const storedState = request.cookies.get(STATE_COOKIE)?.value;
  const redirectTo =
    request.cookies.get("outlook_oauth_redirect")?.value ?? "/settings";
  const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/settings";

  const clearCookies = (response: NextResponse) => {
    response.cookies.delete(STATE_COOKIE);
    response.cookies.delete("outlook_oauth_redirect");
    return response;
  };

  if (error) {
    const settingsUrl = new URL(safeRedirect, origin);
    settingsUrl.searchParams.set(
      "outlook_error",
      errorDescription ?? error ?? "outlook_auth_failed"
    );
    return clearCookies(NextResponse.redirect(settingsUrl));
  }

  if (!code || !state || !storedState || state !== storedState) {
    const settingsUrl = new URL(safeRedirect, origin);
    settingsUrl.searchParams.set("outlook_error", "invalid_oauth_state");
    return clearCookies(NextResponse.redirect(settingsUrl));
  }

  const redirectResponse = NextResponse.redirect(`${origin}${safeRedirect}`);
  const supabase = createClient(request, redirectResponse);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "login_required");
    loginUrl.searchParams.set("redirect", safeRedirect);
    return clearCookies(NextResponse.redirect(loginUrl));
  }

  try {
    const tokens = await exchangeOutlookAuthCode({ origin, code });
    const outlookAddress =
      (await fetchOutlookProfileEmail(tokens.accessToken)) ??
      user.email ??
      "unknown@outlook.com";

    const expiresAt = new Date(
      Date.now() + tokens.expiresIn * 1000
    ).toISOString();

    await saveOutlookConnection(user.id, {
      outlookAddress,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      tokenExpiresAt: expiresAt,
    });

    const successUrl = new URL(safeRedirect, origin);
    successUrl.searchParams.set("outlook_connected", "1");
    const successResponse = NextResponse.redirect(successUrl.toString());
    return clearCookies(successResponse);
  } catch (exchangeError) {
    const settingsUrl = new URL(safeRedirect, origin);
    settingsUrl.searchParams.set(
      "outlook_error",
      exchangeError instanceof Error
        ? exchangeError.message
        : "outlook_token_exchange_failed"
    );
    return clearCookies(NextResponse.redirect(settingsUrl));
  }
}
