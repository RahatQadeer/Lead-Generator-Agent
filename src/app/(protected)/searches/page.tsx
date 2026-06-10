import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";

export default function SearchesPage() {
  return (
    <>
      <PageHeader
        icon={Search}
        label="Searches"
        title="Company searches"
        description="Define your ideal customer profile and let AI find matching companies."
      />
      <EmptyState
        icon={Search}
        title="No searches yet"
        description="Create your first search to find companies that match your target industry, size, and location."
      />
    </>
  );
}
