"use client";

/**
 * Filter summary + the run control.
 *
 * The summary exists because a run costs minutes and the filters are spread over
 * five sections — a user should be able to confirm what they are about to ask
 * for without scrolling back up and re-reading every control.
 */
import { Controller, type Control } from "react-hook-form";
import { Loader2, Play, ListChecks } from "lucide-react";
import { SectionShell } from "@/components/search-builder/sections/SectionShell";
import {
  COMPANY_TYPE_LABELS,
  CONTACT_TYPE_LABELS,
  FUNDING_STAGE_LABELS,
  ROLE_OPTIONS,
} from "@/lib/search-builder/labels";
import {
  RECENTLY_FUNDED_OPTIONS,
  type SearchBuilderInput,
  type SearchBuilderValues,
} from "@/lib/search-builder/schema";

interface Props {
  control: Control<SearchBuilderInput>;
  values: SearchBuilderValues;
  isValid: boolean;
  running: boolean;
  onRun: () => void;
}

interface SummaryRow {
  label: string;
  value: string;
}

function buildSummary(values: SearchBuilderValues): SummaryRow[] {
  const roleLabel = (key: string) =>
    ROLE_OPTIONS.find((option) => option.value === key)?.label ?? key;

  const size =
    values.companySizeMin === null && values.companySizeMax === null
      ? "Any"
      : `${values.companySizeMin ?? 0}–${values.companySizeMax ?? "∞"}`;

  const recency = RECENTLY_FUNDED_OPTIONS.find(
    (option) => option.value === values.recentlyFundedMonths
  )?.label;

  return [
    { label: "Countries", value: values.countries.join(", ") || "Anywhere" },
    { label: "Industries", value: values.industries.join(", ") || "Any" },
    { label: "Company size", value: size },
    {
      label: "Company type",
      value: values.companyType ? COMPANY_TYPE_LABELS[values.companyType] : "Any",
    },
    {
      label: "Funding stage",
      value:
        values.fundingStages.map((s) => FUNDING_STAGE_LABELS[s]).join(", ") || "Any",
    },
    { label: "Recently funded", value: recency ?? "Any time" },
    { label: "Keywords", value: values.keywords.join(", ") || "None" },
    {
      label: "Decision makers",
      value: values.roleKeys.map(roleLabel).join(", ") || "Best available",
    },
    {
      label: "Contact channels",
      value:
        values.contactTypes.map((t) => CONTACT_TYPE_LABELS[t]).join(", ") || "None",
    },
    {
      label: "Providers",
      value:
        values.enabledProviders.length === 0
          ? "All available"
          : `${values.enabledProviders.length} selected`,
    },
  ];
}

export function ReviewAndRunSection({ control, values, isValid, running, onRun }: Props) {
  const summary = buildSummary(values);

  return (
    <SectionShell
      icon={ListChecks}
      title="Review & run"
      description="Check the filters, then start the pipeline."
    >
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {summary.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-dashed border-gray-100 py-1.5 dark:border-gray-800">
            <dt className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
              {row.label}
            </dt>
            <dd className="truncate text-right text-xs text-gray-900 dark:text-gray-200" title={row.value}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="limit"
          render={({ field }) => (
            <div>
              <label
                htmlFor="limit"
                className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-gray-100"
              >
                Max companies
              </label>
              <input
                id="limit"
                type="number"
                min={0}
                max={500}
                value={field.value}
                onChange={(event) => field.onChange(Number(event.target.value))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
              <p className="mt-1 text-xs text-gray-400">0 means no limit (capped at 500).</p>
            </div>
          )}
        />

        <Controller
          control={control}
          name="enrichCompanies"
          render={({ field }) => (
            <div className="flex items-start gap-2.5 pt-7">
              <input
                id="enrichCompanies"
                type="checkbox"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <label htmlFor="enrichCompanies" className="text-sm text-gray-700 dark:text-gray-300">
                Visit each company website
                <span className="mt-0.5 block text-xs text-gray-400">
                  Richer records, but roughly doubles the run time.
                </span>
              </label>
            </div>
          )}
        />
      </div>

      <button
        type="button"
        onClick={onRun}
        disabled={!isValid || running}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {running ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Running…
          </>
        ) : (
          <>
            <Play className="h-4 w-4" aria-hidden="true" />
            Run search
          </>
        )}
      </button>

      {!isValid && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Fix the highlighted fields before running.
        </p>
      )}
    </SectionShell>
  );
}
