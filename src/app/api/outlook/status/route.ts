import { NextResponse } from "next/server";
import { getOutlookConnection } from "@/lib/outlook/connection";
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

  const connection = await getOutlookConnection(user.id);
  const provider = getConfiguredSendingProviderName();

  return NextResponse.json({
    success: true,
    status: {
      connected: Boolean(connection?.refresh_token),
      accountAddress: connection?.outlook_address ?? null,
      provider,
    },
  });
}
