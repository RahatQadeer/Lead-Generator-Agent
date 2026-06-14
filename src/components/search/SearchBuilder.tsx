"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus } from "lucide-react";
import { SearchBuilderForm } from "@/components/search/SearchBuilderForm";
import { SavedSearchesPanel } from "@/components/search/SavedSearchesPanel";
import { SectionCard } from "@/components/ui/SectionCard";
import { alertSuccessClassName, btnSmPrimaryClassName } from "@/lib/ui/styles";
import type { SearchRecord } from "@/types/search";

interface SearchBuilderProps {
  initialSearches: SearchRecord[];
}

export function SearchBuilder({ initialSearches }: SearchBuilderProps) {
  const router = useRouter();
  const [editingSearch, setEditingSearch] = useState<SearchRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showForm = formOpen || editingSearch !== null;

  function handleRefresh() {
    router.refresh();
  }

  function handleCreate() {
    setEditingSearch(null);
    setFormOpen(true);
    setSuccessMessage(null);
  }

  function handleEdit(search: SearchRecord) {
    setEditingSearch(search);
    setFormOpen(true);
    setSuccessMessage(null);
  }

  function handleDismissForm() {
    setEditingSearch(null);
    setFormOpen(false);
  }

  function handleSaved(wasEditing: boolean) {
    handleDismissForm();
    setSuccessMessage(
      wasEditing ? "Search updated successfully." : "Search saved successfully."
    );
    router.refresh();
    setTimeout(() => setSuccessMessage(null), 4000);
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

      <div
        className={`grid items-start gap-6 ${
          showForm ? "lg:grid-cols-[1fr_min(100%,420px)] xl:grid-cols-[1fr_420px]" : ""
        }`}
      >
        <SectionCard
          title="Saved searches"
          padContent={false}
          className="overflow-hidden"
          action={
            !showForm ? (
              <button
                type="button"
                onClick={handleCreate}
                className={btnSmPrimaryClassName}
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Create search
              </button>
            ) : undefined
          }
        >
          <div className="border-t border-gray-100 p-6 sm:p-8">
            <SavedSearchesPanel
              searches={initialSearches}
              editingId={editingSearch?.id ?? null}
              onEdit={handleEdit}
              onRefresh={handleRefresh}
            />
          </div>
        </SectionCard>

        {showForm && (
          <aside className="lg:sticky lg:top-6" aria-label="Create or edit search">
            <SearchBuilderForm
              panel
              editingSearch={editingSearch}
              onCancelEdit={handleDismissForm}
              onSaved={handleSaved}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
