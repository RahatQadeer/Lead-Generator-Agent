"use client";

/**
 * Which decision makers to look for.
 *
 * The order of the chips is the ladder's own rank order, and that is explained
 * in the description: the pipeline falls back down this list when the requested
 * role is not present, so the order is behaviour, not decoration.
 */
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { UserSearch } from "lucide-react";
import { ChipGroup } from "@/components/search-builder/fields/ChipGroup";
import { FieldShell } from "@/components/search-builder/fields/FieldShell";
import { SectionShell } from "@/components/search-builder/sections/SectionShell";
import { ROLE_OPTIONS } from "@/lib/search-builder/labels";
import type { SearchBuilderValues } from "@/lib/search-builder/schema";

interface Props {
  control: Control<SearchBuilderValues>;
  errors: FieldErrors<SearchBuilderValues>;
}

export function DecisionMakerSection({ control, errors }: Props) {
  return (
    <SectionShell
      icon={UserSearch}
      title="Decision makers"
      description="Roles to find at each company."
    >
      <Controller
        control={control}
        name="roleKeys"
        render={({ field }) => (
          <FieldShell
            id="roleKeys"
            label="Target roles"
            description="If a role isn't listed at a company, the pipeline falls back to the next best one below."
            error={errors.roleKeys?.message}
          >
            <ChipGroup
              id="roleKeys"
              options={ROLE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                hint: `Priority ${option.rank}`,
              }))}
              value={field.value}
              onChange={field.onChange}
              hasDescription
              hasError={Boolean(errors.roleKeys)}
            />
          </FieldShell>
        )}
      />

      <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
        Leaving this empty searches for the best available decision maker at each
        company, starting from founder and CEO.
      </p>
    </SectionShell>
  );
}
