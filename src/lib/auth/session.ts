import type { AuthError } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";
import { isProtectedPath } from "@/lib/auth/routes";

export type SessionErrorCode = "session_expired" | "invalid_session";

export { isProtectedPath };

/** True only for session token cookies — excludes PKCE code-verifier cookies used during OAuth. */
export function hasSessionCookies(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => {
    if (!cookie.value.length) return false;
    // PKCE verifier: sb-<ref>-auth-token-code-verifier[.N]
    if (cookie.name.includes("-code-verifier")) return false;
    // Session chunks: sb-<ref>-auth-token[.N]
    return cookie.name.includes("-auth-token");
  });
}

/** @deprecated Use hasSessionCookies — kept as alias for clarity in middleware */
export const hasAuthCookies = hasSessionCookies;

export function classifyAuthError(error: AuthError | null): SessionErrorCode {
  if (!error) return "session_expired";

  const message = error.message.toLowerCase();

  if (
    message.includes("expired") ||
    message.includes("refresh_token") ||
    message.includes("session not found")
  ) {
    return "session_expired";
  }

  return "invalid_session";
}

export function copyResponseCookies(
  source: NextResponse,
  target: NextResponse
): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
}

export function buildLoginRedirect(
  request: NextRequest,
  errorCode: string,
  redirectPath?: string
): URL {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("error", errorCode);

  const redirect =
    redirectPath ??
    (isProtectedPath(request.nextUrl.pathname)
      ? request.nextUrl.pathname
      : "/dashboard");

  url.searchParams.set("redirect", redirect);
  return url;
}
