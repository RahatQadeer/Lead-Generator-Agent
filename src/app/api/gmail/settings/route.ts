import { NextResponse } from "next/server";
import {
  deleteGmailSettings,
  getGmailSettingsStatus,
  saveGmailSettings,
} from "@/lib/gmail/settings";
import type { GmailSendingProviderPreference } from "@/types/gmail-settings";
import { createClient } from "@/lib/supabase/server";

function parseSendingProvider(
  value: unknown
): GmailSendingProviderPreference | null {
  if (value === "mock" || value === "gmail") return value;
  return null;
}

export async function PUT(request: Request) {
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

  const body = await request.json();
  const sendingProvider = parseSendingProvider(body.sendingProvider);

  if (!sendingProvider) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "sendingProvider must be mock or gmail.",
        },
      },
      { status: 400 }
    );
  }

  const saved = await saveGmailSettings(user.id, sendingProvider);
  if (!saved) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "SAVE_FAILED", message: "Failed to save Gmail settings." },
      },
      { status: 500 }
    );
  }

  const status = await getGmailSettingsStatus(user.id, user.email);

  return NextResponse.json({ success: true, status });
}

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

  await deleteGmailSettings(user.id);
  const status = await getGmailSettingsStatus(user.id, user.email);

  return NextResponse.json({ success: true, status });
}
