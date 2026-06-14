export const PROTECTED_ROUTES = [
  "/dashboard",
  "/searches",
  "/leads",
  "/emails",
  "/settings",
] as const;

export type ProtectedRoute = (typeof PROTECTED_ROUTES)[number];

/** Routes that must bypass session validation — PKCE verifier cookies exist before a user session. */
export const AUTH_ROUTES = [
  "/auth/callback",
  "/auth/oauth",
  "/auth/outlook",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}
