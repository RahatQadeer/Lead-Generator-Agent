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
import { ContactsPreview } from "@/components/search/ContactsPreview";
import { DiscoverPreview } from "@/components/search/DiscoverPreview";
import { EnrichLeadsPreview } from "@/components/search/EnrichLeadsPreview";
import { ScoreLeadsPreview } from "@/components/search/ScoreLeadsPreview";
import { VerifyEmailsPreview } from "@/components/search/VerifyEmailsPreview";
import { SearchStatusBadge } from "@/components/search/SearchStatusBadge";
import { selectClassName } from "@/components/ui/Field";
import {
  btnIconClassName,
  cardClassName,
  tagDefaultClassName,
  tagExcludeClassName,
} from "@/lib/ui/styles";
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
      className={`${cardClassName} transition-shadow hover:shadow-md ${
        isEditing ? "border-blue-300 ring-2 ring-blue-100" : ""
      }`}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-base font-semibold text-gray-900">
                {search.name}
              </h3>
              <SearchStatusBadge status={search.status} />
              {hasExclusions(search) && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-xs text-red-700">
                  <Ban className="h-3 w-3" />
                  {countExclusions(search.exclusions)} excluded
                </span>
              )}
              {isEditing && (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Editing
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
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

          <div className="flex shrink-0 gap-0.5">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={btnIconClassName}
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
              className={btnIconClassName}
              aria-label={`Duplicate ${search.name}`}
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onEdit}
              disabled={isPending || isEditing}
              className={`${btnIconClassName} hover:bg-blue-50 hover:text-blue-600`}
              aria-label={`Edit ${search.name}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className={`${btnIconClassName} hover:bg-red-50 hover:text-red-600`}
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

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
          <div className="mt-5 space-y-4 border-t border-gray-100 pt-5">
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
              <div className="space-y-2 rounded-xl border border-red-100 bg-red-50/50 p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-red-700">
                  <Ban className="h-3 w-3" />
                  Companies to skip
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

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h4 className="text-sm font-semibold text-gray-900">
                Outreach steps
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                Run these steps in order to find companies, contacts, and
                prepare your campaign.
              </p>

              <DiscoverPreview searchId={search.id} searchName={search.name} />

              <ContactsPreview
                searchId={search.id}
                searchName={search.name}
                jobTitles={search.jobTitles}
              />

              <EnrichLeadsPreview
                searchId={search.id}
                searchName={search.name}
              />

              <VerifyEmailsPreview
                searchId={search.id}
                searchName={search.name}
              />

              <ScoreLeadsPreview
                searchId={search.id}
                searchName={search.name}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label htmlFor={`status-${search.id}`} className="text-xs font-medium text-gray-500">
                Status
              </label>
              <select
                id={`status-${search.id}`}
                value={search.status}
                onChange={(e) =>
                  handleStatusChange(e.target.value as SearchStatus)
                }
                disabled={isPending}
                className={`${selectClassName} max-w-[180px] !min-h-0 py-2 text-xs`}
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
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <p className="mt-0.5 break-words text-gray-900">{value}</p>
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
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className={`${tagDefaultClassName} !font-normal`}>
            <span className="break-all">{tag}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ExcludeTagGroup({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div>
      <span className="text-xs font-medium text-red-600">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className={`${tagExcludeClassName} !font-normal`}>
            <span className="break-all">{tag}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
