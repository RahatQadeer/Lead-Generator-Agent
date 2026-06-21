import { NextResponse } from "next/server";
import { deleteOutlookConnection } from "@/lib/outlook/connection";
import { getOutlookSettingsStatus } from "@/lib/outlook/settings";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
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

  await deleteOutlookConnection(user.id);
  const status = await getOutlookSettingsStatus(user.id, user.email);

  return NextResponse.json({ success: true, status });
}
