import { NextResponse } from "next/server";
import {
  getContactsBySearchId,
  saveEnrichedLeads,
  toLeadEnrichmentInputs,
} from "@/lib/contacts/queries";
import {
  enrichLeadProfiles,
  toLeadEnrichmentErrorResponse,
} from "@/lib/lead-enrichment/enrich";
import { LeadEnrichmentError } from "@/lib/lead-enrichment/errors";
import { createClient } from "@/lib/supabase/server";
import { getSearchById } from "@/lib/search/queries";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AUTH_ERROR",
            message: "Authentication required.",
            retryable: false,
          },
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const searchId = body.searchId as string | undefined;

    if (!searchId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "searchId is required.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    const search = await getSearchById(user.id, searchId);
    if (!search) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SEARCH_NOT_FOUND",
            message: "Search not found.",
            retryable: false,
          },
        },
        { status: 404 }
      );
    }

    const contacts = await getContactsBySearchId(user.id, searchId);
    if (contacts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_CONTACTS",
            message:
              "No contacts found for this search. Discover decision-makers first.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    const inputs = toLeadEnrichmentInputs(contacts);
    const result = await enrichLeadProfiles(inputs, search.id);

    await saveEnrichedLeads(user.id, result.provider, result.leads);

    return NextResponse.json({
      success: true,
      provider: result.provider,
      leads: result.leads,
      meta: {
        enrichedCount: result.enrichedCount,
        skippedCount: result.skippedCount,
        searchId: search.id,
        searchName: search.name,
      },
    });
  } catch (error) {
    const response = toLeadEnrichmentErrorResponse(error);
    const status =
      error instanceof LeadEnrichmentError ? error.statusCode : 500;
    return NextResponse.json(response, { status });
  }
}
