import { NextResponse } from "next/server";
import { deleteGmailConnection } from "@/lib/gmail/connection";
import { getGmailSettingsStatus } from "@/lib/gmail/settings";
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

  await deleteGmailConnection(user.id);
  const status = await getGmailSettingsStatus(user.id, user.email);

  return NextResponse.json({ success: true, status });
}
