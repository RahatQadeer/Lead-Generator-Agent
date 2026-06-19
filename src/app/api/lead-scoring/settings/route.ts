import { NextResponse } from "next/server";
import {
  deleteLeadScoringSettings,
  getLeadScoringSettingsStatus,
  saveLeadScoringSettings,
  validateLeadScoringWeights,
} from "@/lib/lead-scoring/settings";
import type { LeadScoringWeightsInput } from "@/types/lead-scoring-settings";
import { createClient } from "@/lib/supabase/server";

function parseWeights(body: Record<string, unknown>): LeadScoringWeightsInput | null {
  const fields = [
    "industryMatch",
    "companyTypeVerified",
    "companySize",
    "locationMatch",
    "jobRoleMatch",
    "technologyMatch",
  ] as const;

  const weights = {} as LeadScoringWeightsInput;

  for (const field of fields) {
    const value = body[field];
    if (typeof value !== "number") return null;
    weights[field] = value;
  }

  return weights;
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "AUTH_ERROR", message: "Authentication required." },
      },
      { status: 401 }
    );
  }

  const body = await request.json();
  const weights = parseWeights(body);

  if (!weights) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "All weight fields are required: industryMatch, companySize, locationMatch, jobRoleMatch, technologyMatch.",
        },
      },
      { status: 400 }
    );
  }

  const validationError = validateLeadScoringWeights(weights);
  if (validationError) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: validationError },
      },
      { status: 400 }
    );
  }

  const saved = await saveLeadScoringSettings(user.id, weights);
  if (!saved) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SAVE_FAILED",
          message: "Failed to save lead scoring settings.",
        },
      },
      { status: 500 }
    );
  }

  const status = await getLeadScoringSettingsStatus(user.id);

  return NextResponse.json({ success: true, status });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "AUTH_ERROR", message: "Authentication required." },
      },
      { status: 401 }
    );
  }

  await deleteLeadScoringSettings(user.id);
  const status = await getLeadScoringSettingsStatus(user.id);

  return NextResponse.json({ success: true, status });
}
