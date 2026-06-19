"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import {
  countByStatus,
  filterSearches,
  type SortOption,
  type StatusFilter,
} from "@/lib/search/filters";
import { SearchCard } from "@/components/search/SearchCard";
import { PageToolbar } from "@/components/ui/PageToolbar";
import { inputClassName, selectClassName } from "@/components/ui/Field";
import {
  cardClassName,
  iconTileSmClassName,
  pillActiveClassName,
  pillInactiveClassName,
  toolbarGroupClassName,
} from "@/lib/ui/styles";
import type { SearchRecord } from "@/types/search";

const PREVIEW_COUNT = 5;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

interface SavedSearchesPanelProps {
  searches: SearchRecord[];
  editingId: string | null;
  onEdit: (search: SearchRecord) => void;
  onRefresh: () => void;
}

export function SavedSearchesPanel({
  searches,
  editingId,
  onEdit,
  onRefresh,
}: SavedSearchesPanelProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [expanded, setExpanded] = useState(false);

  const counts = useMemo(() => countByStatus(searches), [searches]);

  const filtered = useMemo(
    () => filterSearches(searches, { status: statusFilter, query, sort }),
    [searches, statusFilter, query, sort]
  );

  useEffect(() => {
    setExpanded(false);
  }, [statusFilter, query, sort]);

  const hasMore = filtered.length > PREVIEW_COUNT;
  const visible =
    expanded || !hasMore ? filtered : filtered.slice(0, PREVIEW_COUNT);
  const hiddenCount = Math.max(0, filtered.length - PREVIEW_COUNT);

  return (
    <div className="space-y-5">
      <PageToolbar
        left={
          <div className={`w-full ${toolbarGroupClassName}`}>
            <div className="relative min-w-[200px] flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name, industry, country…"
                className={`${inputClassName} pl-10`}
                aria-label="Filter saved searches"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className={`${selectClassName} w-full sm:w-auto sm:min-w-[160px]`}
              aria-label="Sort saved searches"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        }
        right={
          <div className={`${toolbarGroupClassName} text-xs text-gray-500`}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {filtered.length} of {searches.length} shown
          </div>
        }
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={statusFilter === tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={
              statusFilter === tab.value
                ? pillActiveClassName
                : pillInactiveClassName
            }
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                statusFilter === tab.value
                  ? "bg-violet-100 text-violet-800"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {counts[tab.value]}
            </span>
          </button>
        ))}
      </div>

      {searches.length === 0 ? (
        <PanelEmptyState message="No saved searches yet" />
      ) : filtered.length === 0 ? (
        <PanelEmptyState message="No matches found" />
      ) : (
        <>
          <div className="space-y-4">
            {visible.map((search) => (
              <SearchCard
                key={search.id}
                search={search}
                isEditing={editingId === search.id}
                onEdit={() => onEdit(search)}
                onRefresh={onRefresh}
              />
            ))}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-100 py-2.5 text-sm font-medium text-gray-600 transition-colors duration-200 hover:bg-gray-50 hover:text-gray-900"
            >
              {expanded ? (
                <>
                  Show less
                  <ChevronDown className="h-4 w-4 rotate-180 transition-transform duration-200" />
                </>
              ) : (
                <>
                  Show {hiddenCount} more
                  <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function PanelEmptyState({ message }: { message: string }) {
  return (
    <div
      className={`${cardClassName} border-dashed px-6 py-12 text-center`}
    >
      <div className={`${iconTileSmClassName} mx-auto`}>
        <Search className="h-4 w-4" />
      </div>
      <p className="mt-3 text-sm font-medium text-gray-700">{message}</p>
    </div>
  );
}
