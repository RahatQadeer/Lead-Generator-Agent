import { NextResponse } from "next/server";
import { getContactsBySearchId } from "@/lib/contacts/queries";
import { toEnrichedLead } from "@/lib/contacts/mapper";
import { serializeLeadsToCsv } from "@/lib/export/serialize-leads-csv";
import { createClient } from "@/lib/supabase/server";
import { getSearchById } from "@/lib/search/queries";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_ERROR", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const searchId = searchParams.get("searchId");

    if (!searchId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "searchId is required." } },
        { status: 400 }
      );
    }

    const search = await getSearchById(user.id, searchId);
    if (!search) {
      return NextResponse.json(
        { success: false, error: { code: "SEARCH_NOT_FOUND", message: "Search not found." } },
        { status: 404 }
      );
    }

    const contacts = await getContactsBySearchId(user.id, searchId);
    const leads = contacts
      .map((contact) => toEnrichedLead(contact))
      .filter((lead): lead is NonNullable<typeof lead> => lead !== null);

    const csv = serializeLeadsToCsv(leads);
    const filename = `${search.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "leads"}-export.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "PROVIDER_ERROR", message: "Export failed. Please try again." },
      },
      { status: 500 }
    );
  }
}
