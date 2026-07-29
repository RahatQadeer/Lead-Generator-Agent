import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  countDiscardedContactsBySearchId,
  getContactsBySearchId,
  discardContacts,
  restoreDiscardedContactsForSearch,
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
import {
  createSseResponse,
  wantsEventStream,
  type ProgressReporter,
} from "@/lib/sse/stream";
import { createClient } from "@/lib/supabase/server";
import { getSearchById } from "@/lib/search/queries";

export const maxDuration = 300;

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

    let contacts = await getContactsBySearchId(user.id, searchId);
    if (contacts.length === 0) {
      const discardedCount = await countDiscardedContactsBySearchId(
        user.id,
        searchId
      );

      if (discardedCount > 0) {
        await restoreDiscardedContactsForSearch(user.id, searchId);
        contacts = await getContactsBySearchId(user.id, searchId);
      }
    }

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

    // Runs enrichment + verification and returns the same payload for both the JSON
    // and SSE paths. `onProgress` is only wired in the streaming branch.
    const runEnrichment = async (onProgress?: ProgressReporter) => {
      const result = await enrichLeadProfiles(inputs, search.id, onProgress);

      await saveEnrichedLeads(user.id, result.provider, result.leads);
      await discardContacts(user.id, result.discardedIds);

      if (result.enrichedCount > 0 && search.status === "draft") {
        await supabase
          .from("searches")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", search.id)
          .eq("user_id", user.id);
      }

      revalidatePath("/leads");
      revalidatePath("/searches");
      revalidatePath("/dashboard");

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
        onProgress?.({ phase: "Verifying email deliverability…" });
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

      return {
        success: true as const,
        provider: result.provider,
        leads: result.leads.map(toContactDetailsView),
        meta: {
          enrichedCount: result.enrichedCount,
          skippedCount: result.skippedCount,
          discardedCount: result.discardedCount,
          emailLeadCount: result.leads.filter((l) => l.outreachChannel === "email")
            .length,
          linkedInLeadCount: result.leads.filter(
            (l) => l.outreachChannel === "linkedin"
          ).length,
          emailVerification: emailVerificationMeta,
          searchId: search.id,
          searchName: search.name,
        },
      };
    };

    if (wantsEventStream(request)) {
      return createSseResponse(async (emit) => {
        try {
          const payload = await runEnrichment((event) => emit("progress", event));
          emit("done", payload);
        } catch (error) {
          emit("done", toLeadEnrichmentErrorResponse(error));
        }
      });
    }

    return NextResponse.json(await runEnrichment());
  } catch (error) {
    console.error("Lead enrichment failed:", error);
    const response = toLeadEnrichmentErrorResponse(error);
    const status =
      error instanceof LeadEnrichmentError ? error.statusCode : 500;
    return NextResponse.json(response, { status });
  }
}
