"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getSearchById } from "@/lib/search/queries";
import { validateSearchCriteria } from "@/lib/search/schema";
import type { SearchCriteria, SearchCriteriaInput, SearchStatus } from "@/types/search";

export type SearchActionResult =
  | { success: true }
  | { success: false; errors: Record<string, string> };

function toDbPayload(criteria: SearchCriteria) {
  return {
    name: criteria.name,
    industry: criteria.industry,
    company_size_min: criteria.companySizeMin,
    company_size_max: criteria.companySizeMax,
    country: criteria.country,
    keywords: criteria.keywords,
    technologies: criteria.technologies,
    job_titles: criteria.jobTitles,
    exclude_domains: criteria.exclusions.domains,
    exclude_industries: criteria.exclusions.industries,
    exclude_keywords: criteria.exclusions.keywords,
    exclude_countries: criteria.exclusions.countries,
    updated_at: new Date().toISOString(),
  };
}

export async function createSearch(
  input: SearchCriteriaInput
): Promise<SearchActionResult> {
  const { user } = await getAuthContext();
  const validation = validateSearchCriteria(input);

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("searches").insert({
    user_id: user.id,
    ...toDbPayload(validation.data),
    status: "draft",
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

  const supabase = await createClient();

  const { error } = await supabase
    .from("searches")
    .update(toDbPayload(validation.data))
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

export async function duplicateSearch(id: string): Promise<SearchActionResult> {
  const { user } = await getAuthContext();
  const search = await getSearchById(user.id, id);

  if (!search) {
    return { success: false, errors: { form: "Search not found." } };
  }

  const supabase = await createClient();
  const copyName = search.name.endsWith(" (copy)")
    ? `${search.name} 2`
    : `${search.name} (copy)`;

  const { error } = await supabase.from("searches").insert({
    user_id: user.id,
    name: copyName,
    industry: search.industry,
    company_size_min: search.companySizeMin,
    company_size_max: search.companySizeMax,
    country: search.country,
    keywords: search.keywords,
    technologies: search.technologies,
    job_titles: search.jobTitles,
    exclude_domains: search.exclusions.domains,
    exclude_industries: search.exclusions.industries,
    exclude_keywords: search.exclusions.keywords,
    exclude_countries: search.exclusions.countries,
    status: "draft",
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return {
      success: false,
      errors: { form: "Failed to duplicate search." },
    };
  }

  revalidatePath("/searches");
  return { success: true };
}

export async function updateSearchStatus(
  id: string,
  status: SearchStatus
): Promise<SearchActionResult> {
  const { user } = await getAuthContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("searches")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return {
      success: false,
      errors: { form: "Failed to update search status." },
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
