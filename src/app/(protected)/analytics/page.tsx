import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        icon={BarChart3}
        label="Analytics"
        title="Performance insights"
        description="Track leads found, emails sent, replies received, and conversion rates."
      />
      <EmptyState
        icon={BarChart3}
        title="No data yet"
        description="Analytics will populate once you start running searches and sending outreach campaigns."
      />
    </>
  );
}
