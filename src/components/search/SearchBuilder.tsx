"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { SearchBuilderForm } from "@/components/search/SearchBuilderForm";
import { SavedSearchesPanel } from "@/components/search/SavedSearchesPanel";
import { alertSuccessClassName } from "@/lib/ui/styles";
import type { SearchRecord } from "@/types/search";

interface SearchBuilderProps {
  initialSearches: SearchRecord[];
}

export function SearchBuilder({ initialSearches }: SearchBuilderProps) {
  const router = useRouter();
  const [editingSearch, setEditingSearch] = useState<SearchRecord | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleRefresh() {
    router.refresh();
  }

  function handleEdit(search: SearchRecord) {
    setEditingSearch(search);
    setSuccessMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSaved(wasEditing: boolean) {
    setEditingSearch(null);
    setSuccessMessage(
      wasEditing ? "Search updated successfully." : "Search saved successfully."
    );
    router.refresh();
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  function handleCancelEdit() {
    setEditingSearch(null);
  }

  return (
    <div className="space-y-6">
      {successMessage && (
        <div
          role="status"
          className={`flex items-center gap-3 ${alertSuccessClassName}`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {successMessage}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <SearchBuilderForm
            editingSearch={editingSearch}
            onCancelEdit={handleCancelEdit}
            onSaved={handleSaved}
          />
        </div>

        <div className="xl:col-span-3">
          <SavedSearchesPanel
            searches={initialSearches}
            editingId={editingSearch?.id ?? null}
            onEdit={handleEdit}
            onRefresh={handleRefresh}
          />
        </div>
      </div>
    </div>
  );
}
