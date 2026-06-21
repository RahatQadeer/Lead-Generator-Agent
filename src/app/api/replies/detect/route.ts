import { NextResponse } from "next/server";
import {
  detectEmailReplies,
  toReplyTrackingErrorResponse,
} from "@/lib/reply-tracking/detect";
import { ReplyTrackingError } from "@/lib/reply-tracking/errors";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
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

    const result = await detectEmailReplies(user.id);

    return NextResponse.json({
      success: true,
      result,
      meta: {
        provider: result.provider,
        checkedCount: result.checkedCount,
        repliesFound: result.repliesFound,
      },
    });
  } catch (error) {
    const response = toReplyTrackingErrorResponse(error);
    const status =
      error instanceof ReplyTrackingError ? error.statusCode : 500;
    return NextResponse.json(response, { status });
  }
}
