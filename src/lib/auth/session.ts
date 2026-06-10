import type { AuthError } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";

export type SessionErrorCode = "session_expired" | "invalid_session";

const PROTECTED_PREFIXES = ["/dashboard"];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function hasAuthCookies(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("-auth-token") && cookie.value.length > 0);
}

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
    target.cookies.set(cookie.name, cookie.value);
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
