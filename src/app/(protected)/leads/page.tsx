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
      <PageHeader icon={Users} title="Leads" />
      {leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No leads yet"
          description="Enrich contacts from a saved search and set its status to Active to see leads here. Draft searches stay in the pipeline until you're ready."
        />
      ) : (
        <LeadsList leads={leads} />
      )}
    </>
  );
}
