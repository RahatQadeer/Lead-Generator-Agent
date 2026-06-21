import type { SearchStatus } from "@/types/search";

const STATUS_STYLES: Record<SearchStatus, string> = {
  draft: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  completed: "border-blue-500/30 bg-blue-500/10 text-blue-300",
};

export function SearchStatusBadge({ status }: { status: SearchStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
