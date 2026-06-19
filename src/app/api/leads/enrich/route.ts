import { NextResponse } from "next/server";
import {
  countDiscardedContactsBySearchId,
  getContactsBySearchId,
  discardContacts,
  saveEnrichedLeads,
  saveEmailVerificationResults,
  toEmailVerificationInputs,
  toLeadEnrichmentInputs,
} from "@/lib/contacts/queries";
import {
  enrichLeadProfiles,
  toLeadEnrichmentErrorResponse,
} from "@/lib/lead-enrichment/enrich";
import { LeadEnrichmentError } from "@/lib/lead-enrichment/errors";
import { verifyContactEmails } from "@/lib/email-verification/verify";
import { toContactDetailsView } from "@/lib/pipeline/public-views";
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
      const discardedCount = await countDiscardedContactsBySearchId(
        user.id,
        searchId
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: discardedCount > 0 ? "CONTACTS_DISCARDED" : "NO_CONTACTS",
            message:
              discardedCount > 0
                ? `${discardedCount} contact${discardedCount === 1 ? "" : "s"} were discarded earlier (no email or LinkedIn found). Click “Find people” again, then retry this step.`
                : "No contacts found for this search. Discover decision-makers first.",
            retryable: discardedCount > 0,
          },
        },
        { status: 400 }
      );
    }

    const inputs = toLeadEnrichmentInputs(contacts, search.industry);
    const result = await enrichLeadProfiles(inputs, search.id);

    await saveEnrichedLeads(user.id, result.provider, result.leads);
    await discardContacts(user.id, result.discardedIds);

    const refreshedContacts = await getContactsBySearchId(user.id, searchId);
    const emailContacts = refreshedContacts.filter(
      (contact) =>
        contact.enriched_at &&
        contact.outreach_channel === "email" &&
        contact.email
    );

    let emailVerificationMeta = {
      verifiedCount: 0,
      likelyValidCount: 0,
      invalidCount: 0,
    };

    if (emailContacts.length > 0) {
      const verification = await verifyContactEmails(
        toEmailVerificationInputs(emailContacts)
      );
      await saveEmailVerificationResults(user.id, verification.results);
      emailVerificationMeta = {
        verifiedCount: verification.validCount,
        likelyValidCount: verification.riskyCount,
        invalidCount: verification.invalidCount,
      };
    }

    return NextResponse.json({
      success: true,
      provider: result.provider,
      leads: result.leads.map(toContactDetailsView),
      meta: {
        enrichedCount: result.enrichedCount,
        skippedCount: result.skippedCount,
        discardedCount: result.discardedCount,
        emailLeadCount: result.leads.filter((l) => l.outreachChannel === "email").length,
        linkedInLeadCount: result.leads.filter((l) => l.outreachChannel === "linkedin")
          .length,
        emailVerification: emailVerificationMeta,
        searchId: search.id,
        searchName: search.name,
      },
    });
  } catch (error) {
    console.error("Lead enrichment failed:", error);
    const response = toLeadEnrichmentErrorResponse(error);
    const status =
      error instanceof LeadEnrichmentError ? error.statusCode : 500;
    return NextResponse.json(response, { status });
  }
}
