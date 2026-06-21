import { NextResponse } from "next/server";
import {
  getContactsBySearchId,
  saveEmailVerificationResults,
  toEmailVerificationInputs,
} from "@/lib/contacts/queries";
import { EmailVerificationError } from "@/lib/email-verification/errors";
import {
  toEmailVerificationErrorResponse,
  verifyContactEmails,
} from "@/lib/email-verification/verify";
import { toEmailVerificationView } from "@/lib/pipeline/public-views";
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
    const enrichedContacts = contacts.filter((contact) => contact.enriched_at);
    const emailContacts = enrichedContacts.filter(
      (contact) =>
        contact.outreach_channel === "email" ||
        (!contact.outreach_channel && contact.email)
    );
    const linkedInLeadCount = enrichedContacts.filter(
      (contact) => contact.outreach_channel === "linkedin"
    ).length;

    if (enrichedContacts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_CONTACTS",
            message:
              "No enriched contacts found. Run step 3 (Add contact details) first.",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    const inputs = toEmailVerificationInputs(emailContacts);
    const result = await verifyContactEmails(inputs);

    await saveEmailVerificationResults(user.id, result.results);

    const nameByContactId = new Map(
      enrichedContacts.map((contact) => [contact.id, contact.full_name])
    );

    return NextResponse.json({
      success: true,
      provider: result.provider,
      results: result.results.map((item) =>
        toEmailVerificationView(item, nameByContactId.get(item.contactId) ?? "Unknown")
      ),
      meta: {
        validCount: result.validCount,
        invalidCount: result.invalidCount,
        riskyCount: result.riskyCount,
        skippedCount: result.skippedCount,
        linkedInLeadCount,
        searchId: search.id,
        searchName: search.name,
      },
    });
  } catch (error) {
    const response = toEmailVerificationErrorResponse(error);
    const status =
      error instanceof EmailVerificationError ? error.statusCode : 500;
    return NextResponse.json(response, { status });
  }
}
