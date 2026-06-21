import { NextResponse } from "next/server";
import { getReplySummary } from "@/lib/reply-tracking/queries";
import { getConfiguredReplyTrackingProvider } from "@/lib/reply-tracking/factory";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

  const summary = await getReplySummary(user.id);
  const provider = getConfiguredReplyTrackingProvider();

  return NextResponse.json({
    success: true,
    summary,
    provider,
  });
}
