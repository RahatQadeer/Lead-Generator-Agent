import { Search } from "lucide-react";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getUserSearches } from "@/lib/search/queries";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchCriteriaForm } from "@/components/search/SearchCriteriaForm";
import { SearchCard } from "@/components/search/SearchCard";

export default async function SearchesPage() {
  const { user } = await getAuthContext();
  const searches = await getUserSearches(user.id);

  return (
    <>
      <PageHeader
        icon={Search}
        label="Searches"
        title="Company searches"
        description="Define your ideal customer profile — industry, size, location, technologies, and decision-makers."
      />

      <div className="grid gap-8 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <SearchCriteriaForm />
        </div>

        <div className="xl:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Saved searches ({searches.length})
            </h2>
          </div>

          {searches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 px-6 py-12 text-center">
              <Search className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-400">
                No searches yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Create your first search using the form
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {searches.map((search) => (
                <SearchCard key={search.id} search={search} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
