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
  Ban,
} from "lucide-react";
import { createSearch, updateSearch } from "@/lib/search/actions";
import {
  INDUSTRIES,
  INDUSTRY_SEARCH_ALIASES,
  COUNTRIES,
  COMPANY_SIZE_PRESETS,
  JOB_TITLE_SUGGESTIONS,
  KEYWORD_SUGGESTIONS,
  TECHNOLOGY_SUGGESTIONS,
} from "@/lib/search/constants";
import { toSearchCriteriaInput } from "@/lib/search/mapper";
import { TagInput } from "@/components/search/TagInput";
import { Combobox } from "@/components/ui/Combobox";
import { Field, inputClassName } from "@/components/ui/Field";
import {
  alertErrorClassName,
  btnIconClassName,
  btnPrimaryClassName,
  btnSecondaryClassName,
  cardClassName,
  cardPaddingClassName,
  dashboardCardClassName,
  headingSectionClassName,
  iconTileClassName,
  pillActiveClassName,
  pillInactiveClassName,
} from "@/lib/ui/styles";
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
  excludeDomains: "",
  excludeIndustries: "",
  excludeKeywords: "",
  excludeCountries: "",
};

interface SearchBuilderFormProps {
  editingSearch: SearchRecord | null;
  onCancelEdit: () => void;
  onSaved: (wasEditing: boolean) => void;
  /** Side panel layout with scrollable body */
  panel?: boolean;
  /** Inside modal dialog — compact, no duplicate header */
  variant?: "default" | "dialog";
}

export function SearchBuilderForm({
  editingSearch,
  onCancelEdit,
  onSaved,
  panel = false,
  variant = "default",
}: SearchBuilderFormProps) {
  const isEditing = editingSearch !== null;
  const isDialog = variant === "dialog";
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

  const formHeader = !isDialog ? (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={iconTileClassName}>
          {isEditing ? (
            <Pencil className="h-5 w-5" />
          ) : (
            <Search className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className={headingSectionClassName}>
            {isEditing ? "Edit search" : "New search"}
          </h2>
        </div>
      </div>
      {panel && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className={btnIconClassName}
          aria-label="Close form"
        >
          <X className="h-5 w-5" />
        </button>
      )}
      {!panel && isEditing && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className={btnIconClassName}
          aria-label="Cancel edit"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  ) : null;

  const formError = errors.form ? (
    <div className={`${panel ? "mb-4" : "mb-6"} ${alertErrorClassName}`} role="alert">
      {errors.form}
    </div>
  ) : null;

  const formBody = (
    <>

      <BuilderSection icon={Building2} accent="violet" title="Company profile">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Name"
            htmlFor="name"
            error={errors.name}
            required
          >
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g. US SaaS companies"
              disabled={isPending}
              className={inputClassName}
            />
          </Field>

          <Field
            label="Industry"
            htmlFor="industry"
            error={errors.industry}
            required
          >
            <Combobox
              id="industry"
              value={form.industry}
              onChange={(v) => updateField("industry", v)}
              options={INDUSTRIES}
              searchAliases={INDUSTRY_SEARCH_ALIASES}
              placeholder="Search industries…"
              disabled={isPending}
              allowCustom
              maxOptions={INDUSTRIES.length}
              emptyMessage="No matching industry — press Enter to use your text"
            />
          </Field>

          <Field
            label="Country"
            htmlFor="country"
            error={errors.country}
            required
          >
            <Combobox
              id="country"
              value={form.country}
              onChange={(v) => updateField("country", v)}
              options={COUNTRIES}
              placeholder="Search countries…"
              disabled={isPending}
              allowCustom
              emptyMessage="No match — press Enter to use your country name"
              maxOptions={80}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Company size"
              htmlFor="companySizeMin"
              error={errors.companySize}
              required
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
                      className={
                        isActive ? pillActiveClassName : pillInactiveClassName
                      }
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

      <BuilderSection icon={Filter} accent="sky" title="Filters" optional>
        <div className="space-y-5">
          <Field
            label="Keywords"
            htmlFor="keywords"
            error={errors.keywords}
            optional
          >
            <TagInput
              id="keywords"
              value={form.keywords}
              onChange={(v) => updateField("keywords", v)}
              placeholder="Search keywords…"
              suggestions={KEYWORD_SUGGESTIONS}
              autosuggest
              showAllSuggestions
              disabled={isPending}
            />
          </Field>

          <Field
            label="Technologies"
            htmlFor="technologies"
            error={errors.technologies}
            optional
          >
            <TagInput
              id="technologies"
              value={form.technologies}
              onChange={(v) => updateField("technologies", v)}
              placeholder="Type a technology and press Enter"
              suggestions={TECHNOLOGY_SUGGESTIONS}
              disabled={isPending}
            />
          </Field>
        </div>
      </BuilderSection>

      <BuilderSection icon={Briefcase} accent="emerald" title="Job titles">
        <Field
          label="Job titles"
          htmlFor="jobTitles"
          error={errors.jobTitles}
          required
        >
          <TagInput
            id="jobTitles"
            value={form.jobTitles}
            onChange={(v) => updateField("jobTitles", v)}
            placeholder="Search job titles…"
            suggestions={JOB_TITLE_SUGGESTIONS}
            autosuggest
            showAllSuggestions
            maxSuggestionPills={12}
            disabled={isPending}
          />
        </Field>
      </BuilderSection>

      <BuilderSection icon={Ban} accent="amber" title="Exclusions" optional>
        <div className="space-y-5">
          <Field
            label="Blocked domains"
            htmlFor="excludeDomains"
            error={errors.excludeDomains}
            optional
          >
            <TagInput
              id="excludeDomains"
              value={form.excludeDomains}
              onChange={(v) => updateField("excludeDomains", v)}
              placeholder="Add domain and press Enter"
              disabled={isPending}
              variant="exclude"
            />
          </Field>

          <Field
            label="Blocked industries"
            htmlFor="excludeIndustries"
            error={errors.excludeIndustries}
            optional
          >
            <TagInput
              id="excludeIndustries"
              value={form.excludeIndustries}
              onChange={(v) => updateField("excludeIndustries", v)}
              placeholder="Add industry and press Enter"
              suggestions={INDUSTRIES}
              disabled={isPending}
              variant="exclude"
            />
          </Field>

          <Field
            label="Blocked keywords"
            htmlFor="excludeKeywords"
            error={errors.excludeKeywords}
            optional
          >
            <TagInput
              id="excludeKeywords"
              value={form.excludeKeywords}
              onChange={(v) => updateField("excludeKeywords", v)}
              placeholder="Add keyword and press Enter"
              disabled={isPending}
              variant="exclude"
            />
          </Field>

          <Field
            label="Blocked countries"
            htmlFor="excludeCountries"
            error={errors.excludeCountries}
            optional
          >
            <TagInput
              id="excludeCountries"
              value={form.excludeCountries}
              onChange={(v) => updateField("excludeCountries", v)}
              placeholder="Add country and press Enter"
              suggestions={COUNTRIES}
              disabled={isPending}
              variant="exclude"
            />
          </Field>
        </div>
      </BuilderSection>
    </>
  );

  const formFooter = (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={handleCancel}
        disabled={isPending}
        className={btnSecondaryClassName}
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isPending}
        className={btnPrimaryClassName}
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
  );

  if (isDialog) {
    return (
      <form onSubmit={handleSubmit} className="px-5 py-5 sm:px-6 sm:py-6">
        {formError}
        {formBody}
        <div className="mt-6 border-t border-gray-100 pt-5">{formFooter}</div>
      </form>
    );
  }

  if (panel) {
    return (
      <form
        onSubmit={handleSubmit}
        className={`${dashboardCardClassName} max-h-[calc(100vh-5rem)] overflow-y-auto border-violet-100/90 shadow-[0_8px_32px_rgba(124,58,237,0.08)]`}
      >
        <div className="border-b border-gray-100 bg-gradient-to-b from-violet-50/40 to-white px-5 py-5 sm:px-6">
          {formHeader}
        </div>
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          {formError}
          {formBody}
          <div className="mt-8 border-t border-gray-100 pt-6">{formFooter}</div>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`${cardClassName} ${cardPaddingClassName} ${
        isEditing ? "border-violet-200 ring-2 ring-violet-100/80" : ""
      }`}
    >
      <div className="mb-8">{formHeader}</div>
      {formError}
      {formBody}
      <div className="mt-8 border-t border-gray-100 pt-6">{formFooter}</div>
    </form>
  );
}

const sectionAccentStyles = {
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
} as const;

function BuilderSection({
  icon: Icon,
  title,
  accent = "violet",
  optional = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  accent?: keyof typeof sectionAccentStyles;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 last:mb-0">
      <div className="mb-4 flex items-center gap-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${sectionAccentStyles[accent]}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">
          {title}
          {optional && (
            <span className="ml-1.5 text-xs font-normal text-gray-400">(optional)</span>
          )}
        </h3>
      </div>
      {children}
    </section>
  );
}
