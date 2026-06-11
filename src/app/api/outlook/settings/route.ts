import { NextResponse } from "next/server";
import {
  deleteOutlookSettings,
  getOutlookSettingsStatus,
  saveOutlookSettings,
} from "@/lib/outlook/settings";
import type { OutlookSendingProviderPreference } from "@/types/outlook-settings";
import { createClient } from "@/lib/supabase/server";

function parseSendingProvider(
  value: unknown
): OutlookSendingProviderPreference | null {
  if (value === "mock" || value === "outlook") return value;
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
          message: "sendingProvider must be mock or outlook.",
        },
      },
      { status: 400 }
    );
  }

  const saved = await saveOutlookSettings(user.id, sendingProvider);
  if (!saved) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SAVE_FAILED",
          message: "Failed to save Outlook settings.",
        },
      },
      { status: 500 }
    );
  }

  const status = await getOutlookSettingsStatus(user.id, user.email);

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

  await deleteOutlookSettings(user.id);
  const status = await getOutlookSettingsStatus(user.id, user.email);

  return NextResponse.json({ success: true, status });
}
