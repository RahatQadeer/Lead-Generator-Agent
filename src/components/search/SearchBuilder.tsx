"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus } from "lucide-react";
import { SearchBuilderForm } from "@/components/search/SearchBuilderForm";
import { SavedSearchesPanel } from "@/components/search/SavedSearchesPanel";
import { Modal } from "@/components/ui/Modal";
import { SectionCard } from "@/components/ui/SectionCard";
import { alertSuccessClassName, btnSmPrimaryClassName } from "@/lib/ui/styles";
import type { SearchRecord } from "@/types/search";

interface SearchBuilderProps {
  initialSearches: SearchRecord[];
}

export function SearchBuilder({ initialSearches }: SearchBuilderProps) {
  const router = useRouter();
  const [editingSearch, setEditingSearch] = useState<SearchRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isEditing = editingSearch !== null;

  function handleRefresh() {
    router.refresh();
  }

  function openCreate() {
    setEditingSearch(null);
    setDialogOpen(true);
    setSuccessMessage(null);
  }

  function openEdit(search: SearchRecord) {
    setEditingSearch(search);
    setDialogOpen(true);
    setSuccessMessage(null);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingSearch(null);
  }

  function handleSaved(wasEditing: boolean) {
    closeDialog();
    setSuccessMessage(wasEditing ? "Search updated." : "Search created.");
    router.refresh();
    setTimeout(() => setSuccessMessage(null), 3000);
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

      <SectionCard
        title="Saved searches"
        padContent={false}
        className="overflow-hidden"
        action={
          <button
            type="button"
            onClick={openCreate}
            className={btnSmPrimaryClassName}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Create search
          </button>
        }
      >
        <div className="border-t border-gray-100 p-6 sm:p-8">
          <SavedSearchesPanel
            searches={initialSearches}
            editingId={editingSearch?.id ?? null}
            onEdit={openEdit}
            onRefresh={handleRefresh}
          />
        </div>
      </SectionCard>

      <Modal
        open={dialogOpen}
        onClose={closeDialog}
        title={isEditing ? "Edit search" : "New search"}
        subtitle={isEditing ? editingSearch.name : undefined}
        size="xl"
      >
        <SearchBuilderForm
          variant="dialog"
          editingSearch={editingSearch}
          onCancelEdit={closeDialog}
          onSaved={handleSaved}
        />
      </Modal>
    </div>
  );
}
