import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";

export default function LeadsPage() {
  return (
    <>
      <PageHeader
        icon={Users}
        label="Leads"
        title="Lead pipeline"
        description="Review discovered companies, scored leads, and decision-maker contacts."
      />
      <EmptyState
        icon={Users}
        title="No leads yet"
        description="Run a company search to discover qualified leads and key contacts at target organizations."
      />
    </>
  );
}
