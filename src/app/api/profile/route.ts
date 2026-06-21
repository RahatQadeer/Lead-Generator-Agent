import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const fullName =
    typeof body.fullName === "string" ? body.fullName.trim() : undefined;

  if (fullName === undefined) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "fullName is required." },
      },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "UPDATE_FAILED", message: "Failed to update profile." },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, profile: data });
}
