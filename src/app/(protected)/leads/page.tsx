import { Users } from "lucide-react";
import { LeadsList } from "@/components/leads/LeadsList";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { getEnrichedLeadsByUserId } from "@/lib/contacts/queries";
import { createClient } from "@/lib/supabase/server";

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const leads = user ? await getEnrichedLeadsByUserId(user.id) : [];

  return (
    <>
      <PageHeader
        icon={Users}
        title="Lead pipeline"
        description="Search, filter, and manage enriched contacts — generate outreach and track lead scores."
      />
      {leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No enriched leads yet"
          description="Run company discovery, find decision-makers, then enrich lead profiles from a saved search."
        />
      ) : (
        <LeadsList leads={leads} />
      )}
    </>
  );
}
