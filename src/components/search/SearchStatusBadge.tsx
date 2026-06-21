import type { SearchStatus } from "@/types/search";

const STATUS_STYLES: Record<SearchStatus, string> = {
  draft: "border-gray-200 bg-gray-50 text-gray-600",
  active: "border-emerald-200/80 bg-emerald-50 text-emerald-800",
  completed: "border-violet-200/80 bg-violet-50 text-violet-800",
};

export function SearchStatusBadge({ status }: { status: SearchStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold capitalize tracking-wide ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
