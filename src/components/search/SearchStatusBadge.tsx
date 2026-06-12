import type { SearchStatus } from "@/types/search";

const STATUS_STYLES: Record<SearchStatus, string> = {
  draft: "border-gray-200 bg-gray-100 text-gray-600",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-blue-200 bg-blue-50 text-blue-700",
};

export function SearchStatusBadge({ status }: { status: SearchStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
