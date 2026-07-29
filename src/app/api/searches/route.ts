/**
 * GET  /api/searches   list the user's searches
 * POST /api/searches   create one
 *
 * Returns RAW table rows, not the mapped `SearchRecord` from
 * `lib/search/queries.ts`. That mapper predates migration 035 and silently drops
 * every new column (countries, industries, company_type, funding_stages, …), so
 * a search saved through the builder would come back with its filters missing.
 * The builder's `fromSearchRow()` consumes raw snake_case rows directly.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchBuilderSchema, toSearchRow } from "@/lib/search-builder/schema";

export const runtime = "nodejs";

/** Columns the builder reads back. `*` would also work but this is explicit. */
const SELECT = "*";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "Authentication required." } },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("searches")
      .select(SELECT)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, searches: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: String(error) } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "Authentication required." } },
        { status: 401 }
      );
    }

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
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("searches")
      // The generated Database types predate migration 035 and do not know the
      // new filter columns; the cast is the narrowest way to say so without
      // regenerating types the rest of the app depends on.
      .insert(row as never)
      .select(SELECT)
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, search: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: String(error) } },
      { status: 500 }
    );
  }
}
