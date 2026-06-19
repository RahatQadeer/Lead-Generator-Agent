import { NextResponse } from "next/server";
import { getCompaniesBySearchId } from "@/lib/companies/queries";
import { createClient } from "@/lib/supabase/server";
import { getSearchById } from "@/lib/search/queries";

export async function GET(
  _request: Request,
  context: { params: Promise<{ searchId: string }> }
) {
  try {
    const { searchId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Authentication required." },
        },
        { status: 401 }
      );
    }

    const search = await getSearchById(user.id, searchId);
    if (!search) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Search not found." },
        },
        { status: 404 }
      );
    }

    const companies = await getCompaniesBySearchId(user.id, searchId);

    return NextResponse.json({
      success: true,
      companies: companies.map((company) => ({
        id: company.id,
        name: company.name,
        domain: company.domain,
      })),
    });
  } catch (error) {
    console.error("List search companies failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Failed to load companies for this search." },
      },
      { status: 500 }
    );
  }
}
