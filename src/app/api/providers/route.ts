/**
 * GET /api/providers
 *
 * The provider catalog, grouped by kind. Powers the "Enabled Providers" section
 * of the search builder, which needs to show what exists AND why something is
 * unavailable — a provider missing from the list with no explanation reads as a
 * bug, whereas "not configured" is actionable.
 */
import { NextResponse } from "next/server";
import { bootstrapProviders } from "@/lib/providers";
import { describeProviders } from "@/lib/providers/registry";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

    bootstrapProviders();
    const providers = describeProviders();

    return NextResponse.json({
      success: true,
      providers,
      byKind: {
        company: providers.filter((p) => p.kind === "company"),
        people: providers.filter((p) => p.kind === "people"),
        contact: providers.filter((p) => p.kind === "contact"),
        funding: providers.filter((p) => p.kind === "funding"),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: String(error) } },
      { status: 500 }
    );
  }
}
