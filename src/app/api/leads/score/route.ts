import { NextResponse } from "next/server";
import {
  getContactsBySearchId,
  saveLeadScores,
  toLeadScoringInputs,
} from "@/lib/contacts/queries";
import { detectIntentByCompany } from "@/lib/lead-enrichment/detect-company-intent";
import { mapSearchToScoringCriteria } from "@/lib/lead-scoring/map-criteria";
import { resolveLeadScoringWeights } from "@/lib/lead-scoring/settings";
import { scoreLead } from "@/lib/lead-scoring/score-lead";
import { toLeadQualityView } from "@/lib/pipeline/public-views";
import { createClient } from "@/lib/supabase/server";
import { getSearchById } from "@/lib/search/queries";
import type { IntentAnalysis } from "@/types/intent-signals";

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

    const companyMap = new Map<
      string,
      {
        companyId: string;
        name: string;
        domain: string | null;
        description: string | null;
        industry: string | null;
        technologies: string[] | null;
      }
    >();

    for (const contact of contacts) {
      if (companyMap.has(contact.company_id)) continue;
      companyMap.set(contact.company_id, {
        companyId: contact.company_id,
        name: contact.companies?.name ?? contact.company_name ?? "Unknown",
        domain: contact.companies?.domain ?? null,
        description: contact.companies?.description ?? null,
        industry: contact.companies?.industry ?? null,
        technologies: contact.companies?.technologies ?? null,
      });
    }

    const intentByCompany: Map<string, IntentAnalysis> = await detectIntentByCompany(
      Array.from(companyMap.values())
    );

    const criteria = mapSearchToScoringCriteria(search);
    const inputs = toLeadScoringInputs(contacts).map((input) => {
      const contact = contacts.find((row) => row.id === input.contactId);
      const intent = contact
        ? intentByCompany.get(contact.company_id)
        : undefined;

      return {
        ...input,
        intentScore: intent?.score ?? null,
      };
    });

    const weights = await resolveLeadScoringWeights(user.id);
    const results = inputs.map((input) => {
      const contact = contacts.find((row) => row.id === input.contactId);
      return scoreLead(
        input,
        criteria,
        weights,
        (contact?.contact_detail_type as import("@/types/lead").ContactDetailType) ?? null
      );
    });
    const averageScore =
      results.length > 0
        ? Math.round(
            (results.reduce((sum, result) => sum + result.overallScore, 0) /
              results.length) *
              10
          ) / 10
        : 0;

    const resultsWithIntent = results.map((result) => {
      const contact = contacts.find((row) => row.id === result.contactId);
      const intent = contact ? intentByCompany.get(contact.company_id) : undefined;

      return {
        ...result,
        intentScore: intent?.score ?? null,
        intentSignals: intent?.signals ?? null,
      };
    });

    await saveLeadScores(user.id, resultsWithIntent);

    const resultsWithNames = resultsWithIntent.map((result) => {
      const contact = contacts.find((row) => row.id === result.contactId);
      const leadView = contact ? toLeadQualityView(contact, result) : null;

      return {
        ...result,
        name: contact?.full_name ?? "Unknown",
        role: contact?.title ?? "Unknown",
        lead: leadView,
      };
    });

    const intentLeadCount = resultsWithIntent.filter(
      (result) => (result.intentScore ?? 0) >= 40
    ).length;

    return NextResponse.json({
      success: true,
      results: resultsWithNames,
      meta: {
        scoredCount: results.length,
        averageScore,
        averageOverallScore: averageScore,
        intentLeadCount,
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
          message: "Something went wrong while scoring leads. Please try again.",
          retryable: false,
        },
      },
      { status: 500 }
    );
  }
}
