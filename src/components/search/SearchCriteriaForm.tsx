"use client";

import { useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { createSearch } from "@/lib/search/actions";
import {
  INDUSTRIES,
  COUNTRIES,
  COMPANY_SIZE_PRESETS,
  JOB_TITLE_SUGGESTIONS,
  TECHNOLOGY_SUGGESTIONS,
} from "@/lib/search/constants";
import { TagInput } from "@/components/search/TagInput";
import { Field, inputClassName, selectClassName } from "@/components/ui/Field";
import type { SearchCriteriaInput } from "@/types/search";

const EMPTY_FORM: SearchCriteriaInput = {
  name: "",
  industry: "",
  companySizeMin: "",
  companySizeMax: "",
  country: "",
  keywords: "",
  technologies: "",
  jobTitles: "",
};

export function SearchCriteriaForm() {
  const [form, setForm] = useState<SearchCriteriaInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function updateField<K extends keyof SearchCriteriaInput>(
    key: K,
    value: SearchCriteriaInput[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      delete next.form;
      if (key === "companySizeMin" || key === "companySizeMax") delete next.companySize;
      return next;
    });
  }

  function applySizePreset(min: number, max: number | null) {
    updateField("companySizeMin", String(min));
    updateField("companySizeMax", max !== null ? String(max) : "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
      const result = await createSearch(form);
      if (!result.success) {
        setErrors(result.errors);
        return;
      }
      setForm(EMPTY_FORM);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 sm:p-8"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
          <Search className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">New search</h2>
          <p className="text-sm text-slate-400">
            Define criteria to find your ideal customers
          </p>
        </div>
      </div>

      {errors.form && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errors.form}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Search name" htmlFor="name" error={errors.name}>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="e.g. US Healthcare CTOs"
            disabled={isPending}
            className={inputClassName}
          />
        </Field>

        <Field label="Industry" htmlFor="industry" error={errors.industry}>
          <select
            id="industry"
            value={form.industry}
            onChange={(e) => updateField("industry", e.target.value)}
            disabled={isPending}
            className={selectClassName}
          >
            <option value="">Select industry</option>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Country" htmlFor="country" error={errors.country}>
          <select
            id="country"
            value={form.country}
            onChange={(e) => updateField("country", e.target.value)}
            disabled={isPending}
            className={selectClassName}
          >
            <option value="">Select country</option>
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </Field>

        <div className="sm:col-span-2">
          <Field
            label="Company size"
            htmlFor="companySizeMin"
            error={errors.companySize}
            hint="Select a preset or enter a custom range (employees)"
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {COMPANY_SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applySizePreset(preset.min, preset.max)}
                  disabled={isPending}
                  className="rounded-full border border-white/5 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300 disabled:opacity-50"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                id="companySizeMin"
                type="number"
                min={1}
                value={form.companySizeMin}
                onChange={(e) => updateField("companySizeMin", e.target.value)}
                placeholder="Min employees"
                disabled={isPending}
                className={inputClassName}
              />
              <input
                id="companySizeMax"
                type="number"
                min={1}
                value={form.companySizeMax}
                onChange={(e) => updateField("companySizeMax", e.target.value)}
                placeholder="Max employees"
                disabled={isPending}
                className={inputClassName}
              />
            </div>
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            label="Keywords"
            htmlFor="keywords"
            error={errors.keywords}
            hint="Company descriptors — e.g. digital health, SaaS, B2B"
          >
            <TagInput
              id="keywords"
              value={form.keywords}
              onChange={(v) => updateField("keywords", v)}
              placeholder="Add keyword and press Enter"
              disabled={isPending}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            label="Technologies"
            htmlFor="technologies"
            error={errors.technologies}
            hint="Tech stack or tools the company uses"
          >
            <TagInput
              id="technologies"
              value={form.technologies}
              onChange={(v) => updateField("technologies", v)}
              placeholder="Add technology and press Enter"
              suggestions={TECHNOLOGY_SUGGESTIONS}
              disabled={isPending}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            label="Job titles"
            htmlFor="jobTitles"
            error={errors.jobTitles}
            hint="Decision-makers to target — at least one required"
          >
            <TagInput
              id="jobTitles"
              value={form.jobTitles}
              onChange={(v) => updateField("jobTitles", v)}
              placeholder="Add job title and press Enter"
              suggestions={JOB_TITLE_SUGGESTIONS}
              disabled={isPending}
            />
          </Field>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/30 disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Create search
            </>
          )}
        </button>
      </div>
    </form>
  );
}
