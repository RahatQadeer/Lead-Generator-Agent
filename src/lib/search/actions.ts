"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { validateSearchCriteria } from "@/lib/search/schema";
import type { SearchCriteriaInput } from "@/types/search";

export type SearchActionResult =
  | { success: true }
  | { success: false; errors: Record<string, string> };

export async function createSearch(
  input: SearchCriteriaInput
): Promise<SearchActionResult> {
  const { user } = await getAuthContext();
  const validation = validateSearchCriteria(input);

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { data: criteria } = validation;
  const supabase = await createClient();

  const { error } = await supabase.from("searches").insert({
    user_id: user.id,
    name: criteria.name,
    industry: criteria.industry,
    company_size_min: criteria.companySizeMin,
    company_size_max: criteria.companySizeMax,
    country: criteria.country,
    keywords: criteria.keywords,
    technologies: criteria.technologies,
    job_titles: criteria.jobTitles,
    status: "draft",
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return {
      success: false,
      errors: { form: "Failed to save search. Please try again." },
    };
  }

  revalidatePath("/searches");
  return { success: true };
}

export async function updateSearch(
  id: string,
  input: SearchCriteriaInput
): Promise<SearchActionResult> {
  const { user } = await getAuthContext();
  const validation = validateSearchCriteria(input);

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { data: criteria } = validation;
  const supabase = await createClient();

  const { error } = await supabase
    .from("searches")
    .update({
      name: criteria.name,
      industry: criteria.industry,
      company_size_min: criteria.companySizeMin,
      company_size_max: criteria.companySizeMax,
      country: criteria.country,
      keywords: criteria.keywords,
      technologies: criteria.technologies,
      job_titles: criteria.jobTitles,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return {
      success: false,
      errors: { form: "Failed to update search. Please try again." },
    };
  }

  revalidatePath("/searches");
  return { success: true };
}

export async function deleteSearch(id: string): Promise<SearchActionResult> {
  const { user } = await getAuthContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("searches")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return {
      success: false,
      errors: { form: "Failed to delete search." },
    };
  }

  revalidatePath("/searches");
  return { success: true };
}
