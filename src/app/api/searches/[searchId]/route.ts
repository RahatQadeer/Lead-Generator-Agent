/**
 * GET    /api/searches/[searchId]   load one search into the builder
 * PATCH  /api/searches/[searchId]   save / autosave
 * DELETE /api/searches/[searchId]
 *
 * Raw rows, for the reason given in `../route.ts`.
 *
 * Every query filters on `user_id` in addition to the row id. RLS already
 * enforces ownership, but the explicit filter means a policy regression degrades
 * to "not found" rather than exposing another user's search.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchBuilderSchema, toSearchRow } from "@/lib/search-builder/schema";

export const runtime = "nodejs";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const UNAUTHORIZED = NextResponse.json(
  { success: false, error: { message: "Authentication required." } },
  { status: 401 }
);

const NOT_FOUND = NextResponse.json(
  { success: false, error: { message: "Search not found." } },
  { status: 404 }
);

export async function GET(
  _request: Request,
  context: { params: Promise<{ searchId: string }> }
) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return UNAUTHORIZED;

    const { searchId } = await context.params;
    const { data, error } = await supabase
      .from("searches")
      .select("*")
      .eq("id", searchId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) return NOT_FOUND;

    return NextResponse.json({ success: true, search: data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: String(error) } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ searchId: string }> }
) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return UNAUTHORIZED;

    const { searchId } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = searchBuilderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Invalid search.",
            issues: parsed.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const row = {
      ...toSearchRow(parsed.data),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("searches")
      .update(row)
      .eq("id", searchId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error || !data) return NOT_FOUND;

    return NextResponse.json({ success: true, search: data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: String(error) } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ searchId: string }> }
) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return UNAUTHORIZED;

    const { searchId } = await context.params;
    const { error } = await supabase
      .from("searches")
      .delete()
      .eq("id", searchId)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: String(error) } },
      { status: 500 }
    );
  }
}
