import { NextResponse } from "next/server";
import { getOpenAIModel } from "@/lib/email-generation/factory";
import { getOpenAISettings, resolveEmailGenerationConfig } from "@/lib/openai/settings";
import { testOpenAIConnection } from "@/lib/openai/test-connection";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const config = await resolveEmailGenerationConfig(user.id);
  const userSettings = await getOpenAISettings(user.id);

  const apiKey =
    typeof body.apiKey === "string" && body.apiKey.trim()
      ? body.apiKey.trim()
      : config.apiKey;
  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : userSettings?.model || config.model || getOpenAIModel();

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "NO_API_KEY",
          message: "No API key configured. Add one in Settings or .env.local.",
        },
      },
      { status: 400 }
    );
  }

  const result = await testOpenAIConnection(apiKey, model);

  return NextResponse.json({
    success: result.success,
    result,
  });
}
