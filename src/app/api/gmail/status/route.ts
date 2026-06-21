import { NextResponse } from "next/server";
import { getGmailConnection } from "@/lib/gmail/connection";
import { getConfiguredSendingProviderName } from "@/lib/email-sending/factory";
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

  const connection = await getGmailConnection(user.id);
  const provider = getConfiguredSendingProviderName();

  return NextResponse.json({
    success: true,
    status: {
      connected: Boolean(connection?.refresh_token),
      accountAddress: connection?.gmail_address ?? user.email ?? null,
      gmailAddress: connection?.gmail_address ?? user.email ?? null,
      provider,
    },
  });
}
