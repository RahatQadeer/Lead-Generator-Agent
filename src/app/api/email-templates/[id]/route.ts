import { NextResponse } from "next/server";
import {
  deleteEmailTemplate,
  getEmailTemplateById,
  updateEmailTemplate,
} from "@/lib/email-templates/queries";
import { parseEmailTone } from "@/lib/email-generation/parse-tone";
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const template = await getEmailTemplateById(user.id, id);

  if (!template) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Template not found." },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, template });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const existing = await getEmailTemplateById(user.id, id);

  if (!existing) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Template not found." },
      },
      { status: 404 }
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

  const template = await updateEmailTemplate(user.id, id, input);
  if (!template) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "SAVE_FAILED", message: "Failed to update template." },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, template });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const deleted = await deleteEmailTemplate(user.id, id);

  if (!deleted) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "DELETE_FAILED", message: "Failed to delete template." },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
