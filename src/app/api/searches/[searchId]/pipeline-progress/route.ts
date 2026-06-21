import { NextResponse } from "next/server";
import {
  derivePipelineStepStates,
} from "@/lib/search/pipeline-steps";
import { getSearchPipelineProgress } from "@/lib/search/pipeline-progress";
import { getSearchById } from "@/lib/search/queries";
import { createClient } from "@/lib/supabase/server";

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
        { success: false, error: { message: "Authentication required." } },
        { status: 401 }
      );
    }

    const search = await getSearchById(user.id, searchId);
    if (!search) {
      return NextResponse.json(
        { success: false, error: { message: "Search not found." } },
        { status: 404 }
      );
    }

    const progress = await getSearchPipelineProgress(user.id, searchId);
    const steps = derivePipelineStepStates(progress);

    return NextResponse.json({
      success: true,
      progress,
      steps,
    });
  } catch (error) {
    console.error("Pipeline progress failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load pipeline progress." } },
      { status: 500 }
    );
  }
}
