import { NextResponse } from "next/server";
import { getLeadScoringSettingsStatus } from "@/lib/lead-scoring/settings";
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

  const status = await getLeadScoringSettingsStatus(user.id);

  return NextResponse.json({ success: true, status });
}
