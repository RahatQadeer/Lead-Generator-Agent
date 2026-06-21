import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import {
  DEFAULT_LEAD_SCORING_WEIGHTS,
  type LeadScoringSettings,
  type LeadScoringSettingsStatus,
  type LeadScoringWeights,
  type LeadScoringWeightsInput,
} from "@/types/lead-scoring-settings";

type LeadScoringSettingsRow =
  Database["public"]["Tables"]["lead_scoring_settings"]["Row"];

export { DEFAULT_LEAD_SCORING_WEIGHTS };

function rowToWeights(row: LeadScoringSettingsRow): LeadScoringWeights {
  return {
    industryMatch: row.industry_weight,
    companySize: row.company_size_weight,
    locationMatch: row.location_weight,
    jobRoleMatch: row.job_role_weight,
    technologyMatch: row.technology_weight,
  };
}

function weightsToRow(weights: LeadScoringWeights) {
  return {
    industry_weight: weights.industryMatch,
    company_size_weight: weights.companySize,
    location_weight: weights.locationMatch,
    job_role_weight: weights.jobRoleMatch,
    technology_weight: weights.technologyMatch,
  };
}

export function validateLeadScoringWeights(
  weights: LeadScoringWeightsInput
): string | null {
  const entries: Array<[string, number]> = [
    ["industryMatch", weights.industryMatch],
    ["companySize", weights.companySize],
    ["locationMatch", weights.locationMatch],
    ["jobRoleMatch", weights.jobRoleMatch],
    ["technologyMatch", weights.technologyMatch],
  ];

  for (const [field, value] of entries) {
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      return `${field} must be an integer between 0 and 100.`;
    }
  }

  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total !== 100) {
    return `Weights must sum to 100 (currently ${total}).`;
  }

  return null;
}

function toSettings(row: LeadScoringSettingsRow): LeadScoringSettings {
  return {
    weights: rowToWeights(row),
    updatedAt: row.updated_at,
  };
}

export async function getLeadScoringSettings(
  userId: string
): Promise<LeadScoringSettings | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_scoring_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return toSettings(data);
}

export async function saveLeadScoringSettings(
  userId: string,
  weights: LeadScoringWeights
): Promise<LeadScoringSettings | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_scoring_settings")
    .upsert(
      {
        user_id: userId,
        ...weightsToRow(weights),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to save lead scoring settings:", error?.message);
    return null;
  }

  return toSettings(data);
}

export async function deleteLeadScoringSettings(userId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("lead_scoring_settings")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete lead scoring settings:", error.message);
  }
}

export async function resolveLeadScoringWeights(
  userId: string
): Promise<LeadScoringWeights> {
  const settings = await getLeadScoringSettings(userId);
  return settings?.weights ?? DEFAULT_LEAD_SCORING_WEIGHTS;
}

export async function getLeadScoringSettingsStatus(
  userId: string
): Promise<LeadScoringSettingsStatus> {
  const userSettings = await getLeadScoringSettings(userId);
  const effectiveWeights =
    userSettings?.weights ?? DEFAULT_LEAD_SCORING_WEIGHTS;

  return {
    weights: effectiveWeights,
    effectiveWeights,
    hasUserSettings: Boolean(userSettings),
  };
}
