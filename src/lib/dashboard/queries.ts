import { createClient } from "@/lib/supabase/server";
import type { DashboardOnboardingStep, DashboardStats } from "@/types/dashboard";

export async function getDashboardStats(
  userId: string
): Promise<DashboardStats> {
  const supabase = await createClient();

  const [searches, leads, contacted, companies] = await Promise.all([
    supabase
      .from("searches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("enriched_at", "is", null),
    // A lead is only actionable once at least one contact channel resolved.
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .or("email.not.is.null,linkedin_url.not.is.null,phone.not.is.null"),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  return {
    searchCount: searches.count ?? 0,
    leadCount: leads.count ?? 0,
    contactedLeadCount: contacted.count ?? 0,
    companyCount: companies.count ?? 0,
  };
}

export function getOnboardingSteps(
  stats: DashboardStats
): DashboardOnboardingStep[] {
  return [
    {
      step: 1,
      label: "Define search criteria",
      done: stats.searchCount > 0,
      href: "/searches",
    },
    {
      step: 2,
      label: "Discover companies",
      done: stats.searchCount > 0,
      href: "/searches",
    },
    {
      step: 3,
      label: "Find decision makers",
      done: stats.leadCount > 0,
      href: "/leads",
    },
    {
      step: 4,
      label: "Collect contact details",
      done: stats.contactedLeadCount > 0,
      href: "/leads",
    },
  ];
}
