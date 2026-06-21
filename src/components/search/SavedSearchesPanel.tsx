"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import {
  countByStatus,
  filterSearches,
  type SortOption,
  type StatusFilter,
} from "@/lib/search/filters";
import { SearchCard } from "@/components/search/SearchCard";
import { inputClassName, selectClassName } from "@/components/ui/Field";
import {
  cardClassName,
  iconTileSmClassName,
  pillActiveClassName,
  pillInactiveClassName,
} from "@/lib/ui/styles";
import type { SearchRecord } from "@/types/search";

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

  const counts = useMemo(() => countByStatus(searches), [searches]);

  const filtered = useMemo(
    () => filterSearches(searches, { status: statusFilter, query, sort }),
    [searches, statusFilter, query, sort]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Saved searches
        </h2>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {filtered.length} of {searches.length} shown
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
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
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {counts[tab.value]}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative sm:col-span-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, industry, country…"
            className={`${inputClassName} pl-10`}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className={selectClassName}
          aria-label="Sort saved searches"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {searches.length === 0 ? (
        <PanelEmptyState
          message="No saved searches yet"
          hint="Create one using the builder"
        />
      ) : filtered.length === 0 ? (
        <PanelEmptyState
          message="No matches found"
          hint="Try a different filter or search term"
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((search) => (
            <SearchCard
              key={search.id}
              search={search}
              isEditing={editingId === search.id}
              onEdit={() => onEdit(search)}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PanelEmptyState({
  message,
  hint,
}: {
  message: string;
  hint: string;
}) {
  return (
    <div
      className={`${cardClassName} border-dashed px-6 py-12 text-center`}
    >
      <div className={`${iconTileSmClassName} mx-auto`}>
        <Search className="h-4 w-4" />
      </div>
      <p className="mt-3 text-sm font-medium text-gray-700">{message}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
}
