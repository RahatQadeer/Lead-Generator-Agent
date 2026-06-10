"use client";

import { useTransition } from "react";
import {
  Building2,
  Globe,
  Users,
  Briefcase,
  Tag,
  Cpu,
  Trash2,
  Loader2,
} from "lucide-react";
import { deleteSearch } from "@/lib/search/actions";
import { formatCompanySize } from "@/lib/search/mapper";
import type { SearchRecord } from "@/types/search";

interface SearchCardProps {
  search: SearchRecord;
}

export function SearchCard({ search }: SearchCardProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete "${search.name}"?`)) return;
    startTransition(async () => {
      await deleteSearch(search.id);
    });
  }

  return (
    <article className="rounded-2xl border border-white/5 bg-slate-900/50 p-5 transition-colors hover:border-white/10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-white">
              {search.name}
            </h3>
            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs capitalize text-slate-400">
              {search.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Created{" "}
            {new Date(search.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          aria-label={`Delete ${search.name}`}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
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
          value={search.jobTitles.join(", ") || "—"}
        />
      </div>

      {(search.keywords.length > 0 || search.technologies.length > 0) && (
        <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
          {search.keywords.length > 0 && (
            <TagGroup icon={Tag} label="Keywords" tags={search.keywords} />
          )}
          {search.technologies.length > 0 && (
            <TagGroup icon={Cpu} label="Technologies" tags={search.technologies} />
          )}
        </div>
      )}
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
