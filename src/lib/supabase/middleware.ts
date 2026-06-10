import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { isAuthRoute } from "@/lib/auth/routes";
import {
  buildLoginRedirect,
  classifyAuthError,
  copyResponseCookies,
  hasSessionCookies,
  isProtectedPath,
} from "@/lib/auth/session";

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // OAuth routes carry PKCE code-verifier cookies but no user session yet.
  // Running signOut() here destroys the verifier and breaks the callback.
  if (isAuthRoute(pathname)) {
    return NextResponse.next({ request });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

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
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const staleSession = !user && hasSessionCookies(request);

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
