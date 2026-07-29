"use client";

/** Country, industry, size, type, funding stage, recency and keywords. */
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { Building2 } from "lucide-react";
import { COUNTRIES } from "@/lib/search/countries";
import { INDUSTRIES, KEYWORD_SUGGESTIONS } from "@/lib/search/constants";
import { ChipGroup } from "@/components/search-builder/fields/ChipGroup";
import { FieldShell } from "@/components/search-builder/fields/FieldShell";
import { SearchableMultiSelect } from "@/components/search-builder/fields/SearchableMultiSelect";
import { TagField } from "@/components/search-builder/fields/TagField";
import { SectionShell } from "@/components/search-builder/sections/SectionShell";
import {
  COMPANY_SIZE_BANDS,
  COMPANY_TYPES,
  FUNDING_STAGES,
  RECENTLY_FUNDED_OPTIONS,
  type SearchBuilderValues,
} from "@/lib/search-builder/schema";
import {
  COMPANY_TYPE_LABELS,
  FUNDING_STAGE_LABELS,
} from "@/lib/search-builder/labels";

interface Props {
  control: Control<SearchBuilderValues>;
  errors: FieldErrors<SearchBuilderValues>;
}

export function CompanyFiltersSection({ control, errors }: Props) {
  return (
    <SectionShell
      icon={Building2}
      title="Company filters"
      description="Narrow which companies the pipeline looks for."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="countries"
          render={({ field }) => (
            <FieldShell
              id="countries"
              label="Countries"
              description="Leave empty to search everywhere."
              error={errors.countries?.message}
            >
              <SearchableMultiSelect
                id="countries"
                options={COUNTRIES}
                value={field.value}
                onChange={field.onChange}
                placeholder="Search countries…"
                hasDescription
                hasError={Boolean(errors.countries)}
              />
            </FieldShell>
          )}
        />

        <Controller
          control={control}
          name="industries"
          render={({ field }) => (
            <FieldShell
              id="industries"
              label="Industries"
              description="Type to filter the list."
              error={errors.industries?.message}
            >
              <SearchableMultiSelect
                id="industries"
                options={INDUSTRIES}
                value={field.value}
                onChange={field.onChange}
                placeholder="Search industries…"
                hasDescription
                hasError={Boolean(errors.industries)}
              />
            </FieldShell>
          )}
        />
      </div>

      <FieldShell
        id="company-size"
        label="Company size"
        description="Pick a band, or leave empty for any size."
        error={errors.companySizeMax?.message ?? errors.companySizeMin?.message}
      >
        <Controller
          control={control}
          name="companySizeMin"
          render={({ field: minField }) => (
            <Controller
              control={control}
              name="companySizeMax"
              render={({ field: maxField }) => (
                <div className="flex flex-wrap gap-2">
                  {COMPANY_SIZE_BANDS.map((band) => {
                    const selected =
                      minField.value === band.min && maxField.value === band.max;
                    return (
                      <button
                        key={band.label}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          // Clicking the active band clears it, so a size filter
                          // can be removed without a separate "any" option.
                          minField.onChange(selected ? null : band.min);
                          maxField.onChange(selected ? null : band.max);
                        }}
                        className={[
                          "rounded-full border px-3 py-1.5 text-sm transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
                          selected
                            ? "border-violet-500 bg-violet-50 font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
                        ].join(" ")}
                      >
                        {band.label}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          )}
        />
      </FieldShell>

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="companyType"
          render={({ field }) => (
            <FieldShell id="companyType" label="Company type">
              <ChipGroup
                id="companyType"
                single
                options={COMPANY_TYPES.map((type) => ({
                  value: type,
                  label: COMPANY_TYPE_LABELS[type],
                }))}
                value={field.value ? [field.value] : []}
                onChange={(next) => field.onChange(next[0] ?? null)}
              />
            </FieldShell>
          )}
        />

        <Controller
          control={control}
          name="recentlyFundedMonths"
          render={({ field }) => (
            <FieldShell
              id="recentlyFundedMonths"
              label="Recently funded"
              description="Based on the funding date the source publishes."
            >
              <ChipGroup
                id="recentlyFundedMonths"
                single
                hasDescription
                options={RECENTLY_FUNDED_OPTIONS.map((option) => ({
                  value: String(option.value),
                  label: option.label,
                }))}
                value={field.value !== null ? [String(field.value)] : []}
                onChange={(next) =>
                  field.onChange(next[0] ? Number.parseInt(next[0], 10) : null)
                }
              />
            </FieldShell>
          )}
        />
      </div>

      <Controller
        control={control}
        name="fundingStages"
        render={({ field }) => (
          <FieldShell id="fundingStages" label="Funding stage">
            <ChipGroup
              id="fundingStages"
              options={FUNDING_STAGES.map((stage) => ({
                value: stage,
                label: FUNDING_STAGE_LABELS[stage],
              }))}
              value={field.value}
              onChange={field.onChange}
            />
          </FieldShell>
        )}
      />

      <Controller
        control={control}
        name="keywords"
        render={({ field }) => (
          <FieldShell
            id="keywords"
            label="Keywords"
            description="Matched against name, description, tags and industry."
            error={errors.keywords?.message}
          >
            <TagField
              id="keywords"
              value={field.value}
              onChange={field.onChange}
              suggestions={KEYWORD_SUGGESTIONS}
              hasDescription
              hasError={Boolean(errors.keywords)}
            />
          </FieldShell>
        )}
      />
    </SectionShell>
  );
}
