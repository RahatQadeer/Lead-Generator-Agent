import type { SearchRecord, SearchStatus } from "@/types/search";

export type StatusFilter = "all" | SearchStatus;

export function countByStatus(searches: SearchRecord[]) {
  return searches.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1;
      acc.all += 1;
      return acc;
    },
    { all: 0, draft: 0, active: 0, completed: 0 } as Record<
      "all" | SearchStatus,
      number
    >
  );
}
export type SortOption = "newest" | "oldest" | "name";

export function filterSearches(
  searches: SearchRecord[],
  {
    status,
    query,
    sort,
  }: { status: StatusFilter; query: string; sort: SortOption }
): SearchRecord[] {
  let result = [...searches];

  if (status !== "all") {
    result = result.filter((s) => s.status === status);
  }

  const q = query.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.industry.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q) ||
        s.keywords.some((k) => k.toLowerCase().includes(q)) ||
        s.jobTitles.some((t) => t.toLowerCase().includes(q))
    );
  }

  result.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "oldest")
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return result;
}
