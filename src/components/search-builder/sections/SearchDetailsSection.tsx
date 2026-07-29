"use client";

/** Name and preset picker. */
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { Check, Sparkles, Tag } from "lucide-react";
import { FieldShell, describedBy } from "@/components/search-builder/fields/FieldShell";
import { SectionShell } from "@/components/search-builder/sections/SectionShell";
import {
  SEARCH_PRESETS,
  type SearchBuilderInput,
} from "@/lib/search-builder/schema";

interface Props {
  control: Control<SearchBuilderInput>;
  errors: FieldErrors<SearchBuilderInput>;
  /** Which preset was last applied, for the active state. */
  appliedPresetId: string | null;
  onApplyPreset: (presetId: string) => void;
}

export function SearchDetailsSection({
  control,
  errors,
  appliedPresetId,
  onApplyPreset,
}: Props) {
  return (
    <SectionShell
      icon={Tag}
      title="Search details"
      description="Name this search so you can rerun it later."
    >
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <FieldShell
            id="name"
            label="Search name"
            required
            description="For example: US AI Startups, Fintech Germany."
            error={errors.name?.message}
          >
            <input
              {...field}
              id="name"
              type="text"
              required
              aria-required="true"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy("name", true, Boolean(errors.name))}
              placeholder="US AI Startups"
              className={[
                "w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900",
                "placeholder:text-gray-400 focus:outline-none focus:ring-2",
                "dark:bg-gray-900 dark:text-gray-100",
                errors.name
                  ? "border-red-400 focus:border-red-500 focus:ring-red-500/30"
                  : "border-gray-200 focus:border-violet-500 focus:ring-violet-500/30 dark:border-gray-700",
              ].join(" ")}
            />
          </FieldShell>
        )}
      />

      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" aria-hidden="true" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Start from a preset
          </h3>
        </div>
        <ul className="grid gap-2 sm:grid-cols-3">
          {SEARCH_PRESETS.map((preset) => {
            const active = appliedPresetId === preset.id;
            return (
              <li key={preset.id}>
                <button
                  type="button"
                  onClick={() => onApplyPreset(preset.id)}
                  aria-pressed={active}
                  className={[
                    "h-full w-full rounded-xl border p-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
                    active
                      ? "border-violet-400 bg-violet-50/60 dark:border-violet-700 dark:bg-violet-950/30"
                      : "border-gray-200 bg-white hover:border-violet-300 dark:border-gray-700 dark:bg-gray-900",
                  ].join(" ")}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {preset.label}
                    </span>
                    {active && (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-violet-600"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                    {preset.description}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-gray-400">
          Presets fill the filters below — your search name is never overwritten.
        </p>
      </div>
    </SectionShell>
  );
}
