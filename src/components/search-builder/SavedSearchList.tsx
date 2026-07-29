"use client";

/** Saved searches with select / duplicate / delete. */
import { useState } from "react";
import { Copy, Search, Trash2 } from "lucide-react";

export interface SavedSearchSummary {
  id: string;
  name: string;
  updated_at?: string | null;
  last_run_at?: string | null;
}

interface Props {
  searches: SavedSearchSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SavedSearchList({
  searches,
  activeId,
  onSelect,
  onDuplicate,
  onDelete,
}: Props) {
  // Two-step delete rather than window.confirm: a native dialog blocks the
  // event loop and is unstyleable, and this keeps the action reversible.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  if (searches.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400 dark:border-gray-800">
        No saved searches yet.
      </p>
    );
  }

  return (
    <nav aria-label="Saved searches">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Saved searches
      </h2>
      <ul className="space-y-1">
        {searches.map((search) => {
          const active = search.id === activeId;
          const confirming = pendingDelete === search.id;

          return (
            <li key={search.id}>
              <div
                className={[
                  "group flex items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors",
                  active
                    ? "border-violet-300 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/30"
                    : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/60",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => onSelect(search.id)}
                  aria-current={active ? "true" : undefined}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
                >
                  <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                  <span className="truncate text-sm text-gray-800 dark:text-gray-200">
                    {search.name || "Untitled"}
                  </span>
                </button>

                {confirming ? (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(search.id);
                        setPendingDelete(null);
                      }}
                      className="rounded px-1.5 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(null)}
                      className="rounded px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onDuplicate(search.id)}
                      aria-label={`Duplicate ${search.name}`}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-gray-800"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(search.id)}
                      aria-label={`Delete ${search.name}`}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
