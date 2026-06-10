"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Loader2,
  Search,
  Pencil,
  X,
  Building2,
  Filter,
  Briefcase,
} from "lucide-react";
import { createSearch, updateSearch } from "@/lib/search/actions";
import {
  INDUSTRIES,
  COUNTRIES,
  COMPANY_SIZE_PRESETS,
  JOB_TITLE_SUGGESTIONS,
  TECHNOLOGY_SUGGESTIONS,
} from "@/lib/search/constants";
import { toSearchCriteriaInput } from "@/lib/search/mapper";
import { TagInput } from "@/components/search/TagInput";
import { Field, inputClassName, selectClassName } from "@/components/ui/Field";
import type { SearchCriteriaInput, SearchRecord } from "@/types/search";

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

interface SearchBuilderFormProps {
  editingSearch: SearchRecord | null;
  onCancelEdit: () => void;
  onSaved: (wasEditing: boolean) => void;
}

export function SearchBuilderForm({
  editingSearch,
  onCancelEdit,
  onSaved,
}: SearchBuilderFormProps) {
  const isEditing = editingSearch !== null;
  const [form, setForm] = useState<SearchCriteriaInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setForm(
      editingSearch ? toSearchCriteriaInput(editingSearch) : EMPTY_FORM
    );
    setErrors({});
  }, [editingSearch]);

  function updateField<K extends keyof SearchCriteriaInput>(
    key: K,
    value: SearchCriteriaInput[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      delete next.form;
      if (key === "companySizeMin" || key === "companySizeMax") {
        delete next.companySize;
      }
      return next;
    });
  }

  function applySizePreset(min: number, max: number | null) {
    updateField("companySizeMin", String(min));
    updateField("companySizeMax", max !== null ? String(max) : "");
  }

  function handleCancel() {
    setForm(EMPTY_FORM);
    setErrors({});
    onCancelEdit();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
      const result = isEditing
        ? await updateSearch(editingSearch.id, form)
        : await createSearch(form);

      if (!result.success) {
        setErrors(result.errors);
        return;
      }

      const wasEditing = isEditing;
      setForm(EMPTY_FORM);
      onSaved(wasEditing);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-2xl border bg-slate-900/50 p-6 sm:p-8 ${
        isEditing
          ? "border-cyan-500/30 ring-1 ring-cyan-500/20"
          : "border-white/5"
      }`}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              isEditing ? "bg-cyan-500/20" : "bg-cyan-500/10"
            }`}
          >
            {isEditing ? (
              <Pencil className="h-5 w-5 text-cyan-400" />
            ) : (
              <Search className="h-5 w-5 text-cyan-400" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isEditing ? "Edit search" : "New search"}
            </h2>
            <p className="text-sm text-slate-400">
              {isEditing
                ? `Updating "${editingSearch.name}"`
                : "Build your ideal customer profile"}
            </p>
          </div>
        </div>
        {isEditing && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
            aria-label="Cancel edit"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {errors.form && (
        <div
          className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          {errors.form}
        </div>
      )}

      <BuilderSection
        step={1}
        icon={Building2}
        title="Target company"
        description="Who are you looking for?"
      >
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
              hint="Select a preset or enter a custom employee range"
            >
              <div className="mb-3 flex flex-wrap gap-2">
                {COMPANY_SIZE_PRESETS.map((preset) => {
                  const isActive =
                    form.companySizeMin === String(preset.min) &&
                    form.companySizeMax ===
                      (preset.max !== null ? String(preset.max) : "");

                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applySizePreset(preset.min, preset.max)}
                      disabled={isPending}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                        isActive
                          ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                          : "border-white/5 bg-white/5 text-slate-400 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  id="companySizeMin"
                  type="number"
                  min={1}
                  value={form.companySizeMin}
                  onChange={(e) =>
                    updateField("companySizeMin", e.target.value)
                  }
                  placeholder="Min employees"
                  disabled={isPending}
                  className={inputClassName}
                />
                <input
                  id="companySizeMax"
                  type="number"
                  min={1}
                  value={form.companySizeMax}
                  onChange={(e) =>
                    updateField("companySizeMax", e.target.value)
                  }
                  placeholder="Max employees"
                  disabled={isPending}
                  className={inputClassName}
                />
              </div>
            </Field>
          </div>
        </div>
      </BuilderSection>

      <BuilderSection
        step={2}
        icon={Filter}
        title="Filters"
        description="Narrow down by keywords and tech stack"
      >
        <div className="space-y-5">
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
      </BuilderSection>

      <BuilderSection
        step={3}
        icon={Briefcase}
        title="Decision-makers"
        description="Who should we reach out to?"
      >
        <Field
          label="Job titles"
          htmlFor="jobTitles"
          error={errors.jobTitles}
          hint="At least one job title is required"
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
      </BuilderSection>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {isEditing && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="rounded-xl border border-white/10 px-6 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/30 disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : isEditing ? (
            <>
              <Pencil className="h-4 w-4" />
              Save changes
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

function BuilderSection({
  step,
  icon: Icon,
  title,
  description,
  children,
}: {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 border-b border-white/5 pb-6 last:mb-0 last:border-0 last:pb-0">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-xs font-bold text-cyan-400">
          {step}
        </span>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-500" />
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}
