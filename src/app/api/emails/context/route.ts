import { NextResponse } from "next/server";
import {
  getContactById,
  getSearchKeywordsForContact,
} from "@/lib/emails/queries";
import {
  mapContactToEmailContext,
  toEmailGenerationPreview,
} from "@/lib/email-generation/map-context";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
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
        },
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId");

  if (!contactId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "contactId is required.",
        },
      },
      { status: 400 }
    );
  }

  const contact = await getContactById(user.id, contactId);
  if (!contact) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CONTACT_NOT_FOUND",
          message: "Contact not found.",
        },
      },
      { status: 404 }
    );
  }

  const searchKeywords = await getSearchKeywordsForContact(
    user.id,
    contact.search_id
  );

  const context = mapContactToEmailContext(contact, { searchKeywords });

  return NextResponse.json({
    success: true,
    preview: toEmailGenerationPreview(contactId, context),
  });
}
