import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyAuthError } from "@/lib/auth/session";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        authenticated: false,
        error: error ? classifyAuthError(error) : "login_required",
      },
      { status: 401 }
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
    },
    expiresAt: session?.expires_at ?? null,
  });
}
