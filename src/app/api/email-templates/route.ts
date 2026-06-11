import { NextResponse } from "next/server";
import {
  createEmailTemplate,
  listEmailTemplates,
} from "@/lib/email-templates/queries";
import { parseEmailTone } from "@/lib/email-generation/parse-tone";
import { EMAIL_TEMPLATE_PLACEHOLDERS } from "@/types/email-templates";
import type { EmailTemplateInput } from "@/types/email-templates";
import { createClient } from "@/lib/supabase/server";

function parseTemplateInput(body: Record<string, unknown>): EmailTemplateInput | null {
  const tone = parseEmailTone(body.tone);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const subjectTemplate =
    typeof body.subjectTemplate === "string" ? body.subjectTemplate.trim() : "";
  const bodyTemplate =
    typeof body.bodyTemplate === "string" ? body.bodyTemplate.trim() : "";

  if (!tone || !name || !subjectTemplate || !bodyTemplate) {
    return null;
  }

  return {
    name,
    tone,
    subjectTemplate,
    bodyTemplate,
    isDefault: Boolean(body.isDefault),
  };
}

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

  const templates = await listEmailTemplates(user.id);

  return NextResponse.json({
    success: true,
    templates,
    placeholders: EMAIL_TEMPLATE_PLACEHOLDERS,
  });
}

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

  const body = await request.json();
  const input = parseTemplateInput(body);

  if (!input) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "name, tone, subjectTemplate, and bodyTemplate are required.",
        },
      },
      { status: 400 }
    );
  }

  const template = await createEmailTemplate(user.id, input);
  if (!template) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "SAVE_FAILED", message: "Failed to create template." },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, template });
}
