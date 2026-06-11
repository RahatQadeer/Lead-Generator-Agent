import { NextResponse } from "next/server";
import { getOpenAIModel } from "@/lib/email-generation/factory";
import {
  deleteOpenAISettings,
  getOpenAISettings,
  getOpenAISettingsStatus,
  saveOpenAISettings,
} from "@/lib/openai/settings";
import type { EmailGenerationProviderName } from "@/lib/email-generation/factory";
import { createClient } from "@/lib/supabase/server";

function parseProvider(value: unknown): EmailGenerationProviderName | null {
  if (value === "mock" || value === "openai") return value;
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
  const generationProvider = parseProvider(body.generationProvider);
  const model =
    typeof body.model === "string" ? body.model.trim() : getOpenAIModel();
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
  const clearApiKey = body.clearApiKey === true;

  if (!generationProvider) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "generationProvider must be mock or openai.",
        },
      },
      { status: 400 }
    );
  }

  const existingSettings = await getOpenAISettings(user.id);
  const hasNewKey = Boolean(apiKey?.trim());
  const hasExistingUserKey = Boolean(existingSettings?.apiKey) && !clearApiKey;
  const hasEnvKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  if (
    generationProvider === "openai" &&
    !hasNewKey &&
    !hasExistingUserKey &&
    !hasEnvKey
  ) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "An API key is required when using the OpenAI provider.",
        },
      },
      { status: 400 }
    );
  }

  const saved = await saveOpenAISettings(user.id, {
    generationProvider,
    model: model || getOpenAIModel(),
    apiKey,
    clearApiKey,
  });

  if (!saved) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "SAVE_FAILED", message: "Failed to save OpenAI settings." },
      },
      { status: 500 }
    );
  }

  const status = await getOpenAISettingsStatus(user.id);

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

  await deleteOpenAISettings(user.id);
  const status = await getOpenAISettingsStatus(user.id);

  return NextResponse.json({ success: true, status });
}
