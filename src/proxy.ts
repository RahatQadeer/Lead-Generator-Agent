import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all routes except static assets and OAuth callback/oauth routes.
     * Auth routes are excluded so proxy never destroys PKCE verifier cookies.
     */
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|auth/oauth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
