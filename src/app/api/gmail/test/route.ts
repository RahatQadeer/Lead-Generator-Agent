import { NextResponse } from "next/server";
import { testGmailConnection } from "@/lib/gmail/test-connection";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "AUTH_ERROR", message: "Authentication required." },
      },
      { status: 401 }
    );
  }

  const result = await testGmailConnection(user.id);

  return NextResponse.json({
    success: result.success,
    result,
  });
}
