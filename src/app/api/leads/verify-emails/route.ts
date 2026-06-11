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

    const inputs = toEmailVerificationInputs(contacts);
    const result = await verifyContactEmails(inputs);

    await saveEmailVerificationResults(user.id, result.results);

    return NextResponse.json({
      success: true,
      provider: result.provider,
      results: result.results,
      meta: {
        validCount: result.validCount,
        invalidCount: result.invalidCount,
        riskyCount: result.riskyCount,
        skippedCount: result.skippedCount,
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
