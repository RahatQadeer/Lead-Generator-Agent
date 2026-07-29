"use client";

/**
 * The search builder.
 *
 * Owns the React Hook Form instance and composes the six sections. Sections are
 * presentational and take `control` — they never fetch or persist, so any of
 * them can be reordered, reused or tested in isolation.
 *
 * Autosave is debounced and only fires for a search that already exists: an
 * unsaved draft would otherwise create a row on the first keystroke, and a user
 * who abandons the form would leave an untitled search behind.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Save } from "lucide-react";
import { SearchDetailsSection } from "@/components/search-builder/sections/SearchDetailsSection";
import { CompanyFiltersSection } from "@/components/search-builder/sections/CompanyFiltersSection";
import { DecisionMakerSection } from "@/components/search-builder/sections/DecisionMakerSection";
import { ContactTypesSection } from "@/components/search-builder/sections/ContactTypesSection";
import { ProviderSelectionSection } from "@/components/search-builder/sections/ProviderSelectionSection";
import { ReviewAndRunSection } from "@/components/search-builder/sections/ReviewAndRunSection";
import { LivePipelineProgress } from "@/components/search-builder/LivePipelineProgress";
import { SavedSearchList, type SavedSearchSummary } from "@/components/search-builder/SavedSearchList";
import { usePipelineRun } from "@/hooks/usePipelineRun";
import {
  emptySearchBuilderValues,
  fromSearchRow,
  searchBuilderSchema,
  SEARCH_PRESETS,
  toPipelineRunPayload,
  type SearchBuilderValues,
} from "@/lib/search-builder/schema";

const AUTOSAVE_DEBOUNCE_MS = 1_200;

type SaveState = "idle" | "saving" | "saved" | "error";

interface Props {
  initialSearches: SavedSearchSummary[];
}

export function SearchBuilderPanel({ initialSearches }: Props) {
  const [searches, setSearches] = useState<SavedSearchSummary[]>(initialSearches);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [appliedPreset, setAppliedPreset] = useState<string | null>(null);

  const run = usePipelineRun();
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<SearchBuilderValues>({
    resolver: zodResolver(searchBuilderSchema),
    defaultValues: emptySearchBuilderValues,
    // onChange, not onBlur: the Run button is gated on `formState.isValid`, and
    // with onBlur that flag stays stale until a field is blurred — so the button
    // would sit disabled after the user has already fixed the problem.
    mode: "onChange",
  });

  const { control, handleSubmit, reset, setValue, watch, formState } = form;
  const values = watch();

  // --- persistence -----------------------------------------------------------

  const persist = useCallback(
    async (payload: SearchBuilderValues, id: string | null): Promise<string | null> => {
      setSaveState("saving");
      try {
        const response = await fetch(id ? `/api/searches/${id}` : "/api/searches", {
          method: id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`Save failed (${response.status})`);

        const body = await response.json();
        setSaveState("saved");
        if (body.search) {
          setSearches((current) => {
            const without = current.filter((s) => s.id !== body.search.id);
            return [body.search, ...without];
          });
        }
        return body.search?.id ?? id;
      } catch {
        setSaveState("error");
        return id;
      }
    },
    []
  );

  const saveNow = handleSubmit(async (payload) => {
    const id = await persist(payload, activeId);
    if (id) setActiveId(id);
  });

  // Debounced autosave — existing searches only.
  useEffect(() => {
    if (!activeId || !formState.isDirty) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    autosaveTimer.current = setTimeout(() => {
      void (async () => {
        const valid = await form.trigger();
        if (!valid) return;
        await persist(form.getValues(), activeId);
      })();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // `values` is the trigger: any field change restarts the debounce.
  }, [values, activeId, formState.isDirty, form, persist]);

  // --- saved search actions ---------------------------------------------------

  const loadSearch = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/searches/${id}`);
      if (!response.ok) return;
      const body = await response.json();
      reset(fromSearchRow(body.search));
      setActiveId(id);
      setAppliedPreset(null);
      run.reset();
    },
    [reset, run]
  );

  const newSearch = useCallback(() => {
    reset(emptySearchBuilderValues);
    setActiveId(null);
    setAppliedPreset(null);
    setSaveState("idle");
    run.reset();
  }, [reset, run]);

  const duplicateSearch = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/searches/${id}`);
      if (!response.ok) return;
      const body = await response.json();
      const copy = fromSearchRow(body.search);
      reset({ ...copy, name: `${copy.name} (copy)` });
      // Cleared so the duplicate saves as a NEW row rather than overwriting the
      // original on the next autosave.
      setActiveId(null);
      setSaveState("idle");
    },
    [reset]
  );

  const deleteSearch = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/searches/${id}`, { method: "DELETE" });
      if (!response.ok) return;
      setSearches((current) => current.filter((s) => s.id !== id));
      if (activeId === id) newSearch();
    },
    [activeId, newSearch]
  );

  // --- presets ---------------------------------------------------------------

  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = SEARCH_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      for (const [key, value] of Object.entries(preset.values)) {
        setValue(key as keyof SearchBuilderValues, value as never, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      setAppliedPreset(presetId);
    },
    [setValue]
  );

  // --- run -------------------------------------------------------------------

  const startRun = handleSubmit(async (payload) => {
    // Save first so the run is attached to a persisted search and its results
    // are queryable afterwards.
    const id = (await persist(payload, activeId)) ?? activeId;
    if (id) setActiveId(id);
    await run.start(toPipelineRunPayload(payload, id));
  });

  const running = run.status === "running" || run.status === "starting";
  const showProgress = run.status !== "idle";

  const saveLabel = useMemo(() => {
    if (saveState === "saving") return "Saving…";
    if (saveState === "saved") return "Saved";
    if (saveState === "error") return "Save failed";
    return "Save";
  }, [saveState]);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
      <aside className="lg:sticky lg:top-6">
        <button
          type="button"
          onClick={newSearch}
          className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-violet-400 hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-gray-700 dark:text-gray-400"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New search
        </button>

        <SavedSearchList
          searches={searches}
          activeId={activeId}
          onSelect={loadSearch}
          onDuplicate={duplicateSearch}
          onDelete={deleteSearch}
        />
      </aside>

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void saveNow();
        }}
      >
        {showProgress && (
          <LivePipelineProgress
            status={run.status}
            progress={run.progress}
            error={run.error}
            polling={run.polling}
            onStop={() => void run.stop()}
            onReset={run.reset}
          />
        )}

        <SearchDetailsSection
          control={control}
          errors={formState.errors}
          appliedPresetId={appliedPreset}
          onApplyPreset={applyPreset}
        />

        <CompanyFiltersSection control={control} errors={formState.errors} />
        <DecisionMakerSection control={control} errors={formState.errors} />
        <ContactTypesSection control={control} />
        <ProviderSelectionSection control={control} />

        <ReviewAndRunSection
          control={control}
          values={values}
          isValid={formState.isValid}
          running={running}
          onRun={() => void startRun()}
        />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saveState === "saving"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {saveState === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {saveLabel}
          </button>

          <p aria-live="polite" className="text-xs text-gray-400">
            {activeId ? "Changes autosave." : "Save to enable autosave."}
          </p>
        </div>
      </form>
    </div>
  );
}
