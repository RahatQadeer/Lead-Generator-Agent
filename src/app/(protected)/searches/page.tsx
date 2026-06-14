import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getUserSearches } from "@/lib/search/queries";
import { SearchBuilder } from "@/components/search/SearchBuilder";

export default async function SearchesPage() {
  const { user } = await getAuthContext();
  const searches = await getUserSearches(user.id);

  return <SearchBuilder initialSearches={searches} />;
}
