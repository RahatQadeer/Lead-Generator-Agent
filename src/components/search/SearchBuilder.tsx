"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { SearchBuilderForm } from "@/components/search/SearchBuilderForm";
import { SearchCard } from "@/components/search/SearchCard";
import type { SearchRecord } from "@/types/search";

interface SearchBuilderProps {
  initialSearches: SearchRecord[];
}

export function SearchBuilder({ initialSearches }: SearchBuilderProps) {
  const [editingSearch, setEditingSearch] = useState<SearchRecord | null>(null);

  function handleEdit(search: SearchRecord) {
    setEditingSearch(search);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSaved() {
    setEditingSearch(null);
  }

  function handleCancelEdit() {
    setEditingSearch(null);
  }

  return (
    <div className="grid gap-8 xl:grid-cols-5">
      <div className="xl:col-span-2">
        <SearchBuilderForm
          editingSearch={editingSearch}
          onCancelEdit={handleCancelEdit}
          onSaved={handleSaved}
        />
      </div>

      <div className="xl:col-span-3">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Saved searches ({initialSearches.length})
          </h2>
          {editingSearch && (
            <span className="text-xs text-cyan-400">Editing a search</span>
          )}
        </div>

        {initialSearches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 px-6 py-12 text-center">
            <Search className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-medium text-slate-400">
              No searches yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Use the builder to create your first search
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {initialSearches.map((search) => (
              <SearchCard
                key={search.id}
                search={search}
                isEditing={editingSearch?.id === search.id}
                onEdit={() => handleEdit(search)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
