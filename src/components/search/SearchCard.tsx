"use client";

import { useState, useTransition } from "react";
import {
  Building2,
  Globe,
  Users,
  Briefcase,
  Tag,
  Cpu,
  Trash2,
  Pencil,
  Copy,
  Loader2,
  ChevronDown,
  ChevronUp,
  Ban,
} from "lucide-react";
import {
  deleteSearch,
  duplicateSearch,
  updateSearchStatus,
} from "@/lib/search/actions";
import { countExclusions, hasExclusions } from "@/lib/search/exclusions";
import { formatCompanySize } from "@/lib/search/mapper";
import { SearchStatusBadge } from "@/components/search/SearchStatusBadge";
import { selectClassName } from "@/components/ui/Field";
import type { SearchRecord, SearchStatus } from "@/types/search";

interface SearchCardProps {
  search: SearchRecord;
  isEditing?: boolean;
  onEdit: () => void;
  onRefresh: () => void;
}

export function SearchCard({
  search,
  isEditing,
  onEdit,
  onRefresh,
}: SearchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  function runAction(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      onRefresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${search.name}"?`)) return;
    runAction(() => deleteSearch(search.id));
  }

  function handleDuplicate() {
    runAction(() => duplicateSearch(search.id));
  }

  function handleStatusChange(status: SearchStatus) {
    if (status === search.status) return;
    runAction(() => updateSearchStatus(search.id, status));
  }

  return (
    <article
      className={`rounded-2xl border bg-slate-900/50 transition-colors ${
        isEditing
          ? "border-cyan-500/30 ring-1 ring-cyan-500/20"
          : "border-white/5 hover:border-white/10"
      }`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-white">
                {search.name}
              </h3>
              <SearchStatusBadge status={search.status} />
              {hasExclusions(search) && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs text-red-300">
                  <Ban className="h-3 w-3" />
                  {countExclusions(search.exclusions)} excluded
                </span>
              )}
              {isEditing && (
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">
                  Editing
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Saved{" "}
              {new Date(search.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {" · "}
              Updated{" "}
              {new Date(search.updatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
              aria-label={expanded ? "Collapse details" : "Expand details"}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={isPending}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
              aria-label={`Duplicate ${search.name}`}
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onEdit}
              disabled={isPending || isEditing}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-cyan-500/10 hover:text-cyan-400 disabled:opacity-50"
              aria-label={`Edit ${search.name}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              aria-label={`Delete ${search.name}`}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <CriteriaRow icon={Building2} label="Industry" value={search.industry} />
          <CriteriaRow icon={Globe} label="Country" value={search.country} />
          <CriteriaRow
            icon={Users}
            label="Company size"
            value={formatCompanySize(search.companySizeMin, search.companySizeMax)}
          />
          <CriteriaRow
            icon={Briefcase}
            label="Job titles"
            value={
              search.jobTitles.length > 2 && !expanded
                ? `${search.jobTitles.slice(0, 2).join(", ")} +${search.jobTitles.length - 2}`
                : search.jobTitles.join(", ") || "—"
            }
          />
        </div>

        {expanded && (
          <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
            {search.keywords.length > 0 && (
              <TagGroup icon={Tag} label="Keywords" tags={search.keywords} />
            )}
            {search.technologies.length > 0 && (
              <TagGroup icon={Cpu} label="Technologies" tags={search.technologies} />
            )}
            {search.jobTitles.length > 0 && (
              <TagGroup icon={Briefcase} label="All job titles" tags={search.jobTitles} />
            )}

            {hasExclusions(search) && (
              <div className="space-y-2 rounded-xl border border-red-500/10 bg-red-500/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-red-300">
                  <Ban className="h-3 w-3" />
                  Exclusion rules
                </div>
                {search.exclusions.domains.length > 0 && (
                  <ExcludeTagGroup label="Domains" tags={search.exclusions.domains} />
                )}
                {search.exclusions.industries.length > 0 && (
                  <ExcludeTagGroup label="Industries" tags={search.exclusions.industries} />
                )}
                {search.exclusions.keywords.length > 0 && (
                  <ExcludeTagGroup label="Keywords" tags={search.exclusions.keywords} />
                )}
                {search.exclusions.countries.length > 0 && (
                  <ExcludeTagGroup label="Countries" tags={search.exclusions.countries} />
                )}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <label htmlFor={`status-${search.id}`} className="text-xs text-slate-500">
                Status
              </label>
              <select
                id={`status-${search.id}`}
                value={search.status}
                onChange={(e) =>
                  handleStatusChange(e.target.value as SearchStatus)
                }
                disabled={isPending}
                className={`${selectClassName} max-w-[160px] py-2 text-xs`}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function CriteriaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
      <div className="min-w-0">
        <span className="text-xs text-slate-500">{label}</span>
        <p className="truncate text-slate-300">{value}</p>
      </div>
    </div>
  );
}

function TagGroup({
  icon: Icon,
  label,
  tags,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tags: string[];
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-white/5 bg-white/5 px-2 py-0.5 text-xs text-slate-400"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function ExcludeTagGroup({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div>
      <span className="text-xs text-red-400/80">{label}</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs text-red-300"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
