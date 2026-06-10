import { Search } from "lucide-react";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getUserSearches } from "@/lib/search/queries";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchBuilder } from "@/components/search/SearchBuilder";

export default async function SearchesPage() {
  const { user } = await getAuthContext();
  const searches = await getUserSearches(user.id);

  return (
    <>
      <PageHeader
        icon={Search}
        label="Searches"
        title="Search builder"
        description="Create and edit company search criteria — industry, size, location, technologies, and decision-makers."
      />
      <SearchBuilder initialSearches={searches} />
    </>
  );
}
