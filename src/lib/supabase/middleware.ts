import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import {
  buildLoginRedirect,
  classifyAuthError,
  copyResponseCookies,
  hasAuthCookies,
  isProtectedPath,
} from "@/lib/auth/session";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validates the JWT and refreshes the session when the access token is expired
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const staleSession = !user && hasAuthCookies(request);

  // Reject invalid or expired sessions and clear stale auth cookies
  if (staleSession) {
    await supabase.auth.signOut();

    if (isProtectedPath(pathname)) {
      const loginUrl = buildLoginRedirect(
        request,
        classifyAuthError(authError),
        pathname
      );
      const redirectResponse = NextResponse.redirect(loginUrl);
      return copyResponseCookies(supabaseResponse, redirectResponse);
    }
  }

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = buildLoginRedirect(request, "login_required", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    return copyResponseCookies(supabaseResponse, redirectResponse);
  }

  return supabaseResponse;
}
