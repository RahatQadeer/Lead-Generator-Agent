import { NextResponse } from "next/server";
import {
  getContactsBySearchId,
  saveLeadScores,
  toLeadScoringInputs,
} from "@/lib/contacts/queries";
import { mapSearchToScoringCriteria } from "@/lib/lead-scoring/map-criteria";
import { resolveLeadScoringWeights } from "@/lib/lead-scoring/settings";
import { scoreLeads } from "@/lib/lead-scoring/score-lead";
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

    const criteria = mapSearchToScoringCriteria(search);
    const inputs = toLeadScoringInputs(contacts);
    const weights = await resolveLeadScoringWeights(user.id);
    const { results, averageScore } = scoreLeads(inputs, criteria, weights);

    await saveLeadScores(user.id, results);

    const resultsWithNames = results.map((result) => ({
      ...result,
      name:
        contacts.find((contact) => contact.id === result.contactId)?.full_name ??
        "Unknown",
      role:
        contacts.find((contact) => contact.id === result.contactId)?.title ??
        "Unknown",
    }));

    return NextResponse.json({
      success: true,
      results: resultsWithNames,
      meta: {
        scoredCount: results.length,
        averageScore,
        searchId: search.id,
        searchName: search.name,
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PROVIDER_ERROR",
          message: "An unexpected error occurred during lead scoring.",
          retryable: false,
        },
      },
      { status: 500 }
    );
  }
}
