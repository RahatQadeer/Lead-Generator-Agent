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
  COUNTRIES,
  COMPANY_SIZE_PRESETS,
  JOB_TITLE_SUGGESTIONS,
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
      className={`${cardClassName} ${cardPaddingClassName} ${
        isEditing ? "border-blue-300 ring-2 ring-blue-100" : ""
      }`}
    >
      <div className="mb-8 flex items-start justify-between gap-4">
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
            <p className="mt-1 text-sm text-gray-500">
              {isEditing
                ? `Updating "${editingSearch.name}"`
                : "Describe the companies and people you want to reach"}
            </p>
          </div>
        </div>
        {isEditing && (
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

      {errors.form && (
        <div className={`mb-6 ${alertErrorClassName}`} role="alert">
          {errors.form}
        </div>
      )}

      <BuilderSection
        step={1}
        icon={Building2}
        title="Company profile"
        description="Define the type of company you want to find"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Campaign name"
            htmlFor="name"
            error={errors.name}
            required
            hint="A short name so you can recognize this search later"
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
            hint="Pick a suggestion or type your own, then press Enter"
          >
            <Combobox
              id="industry"
              value={form.industry}
              onChange={(v) => updateField("industry", v)}
              options={INDUSTRIES}
              placeholder="e.g. Healthcare, FinTech, SaaS"
              disabled={isPending}
              allowCustom
              emptyMessage="No matching industries — press Enter to use your text"
            />
          </Field>

          <Field
            label="Country"
            htmlFor="country"
            error={errors.country}
            required
            hint="Search and pick a country"
          >
            <Combobox
              id="country"
              value={form.country}
              onChange={(v) => updateField("country", v)}
              options={COUNTRIES}
              placeholder="Search countries…"
              disabled={isPending}
              emptyMessage="No matching country — check spelling"
              maxOptions={80}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Company size"
              htmlFor="companySizeMin"
              error={errors.companySize}
              required
              hint="How many employees the company should have"
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

      <BuilderSection
        step={2}
        icon={Filter}
        title="Refine your search"
        description="Optional filters to find better matches"
      >
        <div className="space-y-5">
          <Field
            label="Keywords"
            htmlFor="keywords"
            error={errors.keywords}
            optional
            hint="What kind of business they are — e.g. SaaS, B2B, startup"
          >
            <TagInput
              id="keywords"
              value={form.keywords}
              onChange={(v) => updateField("keywords", v)}
              placeholder="Type a keyword and press Enter"
              disabled={isPending}
            />
          </Field>

          <Field
            label="Technologies"
            htmlFor="technologies"
            error={errors.technologies}
            optional
            hint="Software or tools they use — e.g. React, AWS, Salesforce"
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

      <BuilderSection
        step={3}
        icon={Briefcase}
        title="People to contact"
        description="Who should receive your outreach?"
      >
        <Field
          label="Job titles"
          htmlFor="jobTitles"
          error={errors.jobTitles}
          required
          hint="Add at least one role — e.g. CEO, CTO, Marketing Director"
        >
          <TagInput
            id="jobTitles"
            value={form.jobTitles}
            onChange={(v) => updateField("jobTitles", v)}
            placeholder="Type a job title and press Enter"
            suggestions={JOB_TITLE_SUGGESTIONS}
            disabled={isPending}
          />
        </Field>
      </BuilderSection>

      <BuilderSection
        step={4}
        icon={Ban}
        title="Companies to skip"
        description="Optional — block companies you do not want to contact"
        variant="exclude"
      >
        <div className="space-y-5">
          <Field
            label="Blocked websites"
            htmlFor="excludeDomains"
            error={errors.excludeDomains}
            optional
            hint="Skip companies on these domains — e.g. competitor.com"
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
            hint="Skip companies in these industries"
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
            hint="Skip companies that mention these words"
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
            hint="Skip companies based in these countries"
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

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:justify-end">
        {isEditing && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className={btnSecondaryClassName}
          >
            Cancel
          </button>
        )}
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
    </form>
  );
}

function BuilderSection({
  step,
  icon: Icon,
  title,
  description,
  variant = "default",
  children,
}: {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  variant?: "default" | "exclude";
  children: React.ReactNode;
}) {
  const isExclude = variant === "exclude";

  return (
    <section
      className={`mb-8 border-b pb-8 last:mb-0 last:border-0 last:pb-0 ${
        isExclude ? "border-red-100" : "border-gray-100"
      }`}
    >
      <div className="mb-5 flex items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
            isExclude
              ? "bg-red-50 text-red-600"
              : "bg-blue-50 text-blue-600"
          }`}
        >
          {step}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-gray-400" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-xs leading-relaxed text-gray-500">{description}</p>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}
