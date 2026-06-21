"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Download,
  Loader2,
  Mail,
  MapPin,
  Search,
  Trash2,
} from "lucide-react";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";
import { EmailVerificationBadge } from "@/components/leads/EmailVerificationBadge";
import { IntentSignalsBadge } from "@/components/leads/IntentSignalsBadge";
import { GenerateEmailButton } from "@/components/leads/GenerateEmailButton";
import { FollowUpStoppedBadge } from "@/components/emails/FollowUpStoppedBadge";
import { LeadScoreBadge } from "@/components/leads/LeadScoreBadge";
import { isValidPersonLinkedInUrl } from "@/lib/scraping/data-quality";
import { deleteAllLeads, deleteLeads } from "@/lib/leads/actions";
import { inputClassName } from "@/components/ui/Field";
import {
  btnIconSmSecondaryClassName,
  btnSmSecondaryClassName,
  cardClassName,
} from "@/lib/ui/styles";
import { serializeLeadsToCsv } from "@/lib/export/serialize-leads-csv";
import type { EnrichedLead } from "@/types/lead";

interface LeadsListProps {
  leads: EnrichedLead[];
}

function leadInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function LeadAvatar({ name }: { name: string }) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-sm font-semibold text-violet-700 ring-1 ring-violet-100"
      aria-hidden
    >
      {leadInitials(name) || "?"}
    </div>
  );
}

function downloadCsv(leads: EnrichedLead[], suffix: string) {
  const csv = serializeLeadsToCsv(leads);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `leads-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function LeadsList({ leads: initialLeads }: LeadsListProps) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return leads;
    return leads.filter(
      (lead) =>
        lead.name.toLowerCase().includes(normalized) ||
        lead.role.toLowerCase().includes(normalized) ||
        lead.company.toLowerCase().includes(normalized) ||
        lead.email?.toLowerCase().includes(normalized) ||
        lead.location?.toLowerCase().includes(normalized)
    );
  }, [leads, query]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((lead) => selected.has(lead.id));

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const lead of filtered) next.delete(lead.id);
        return next;
      });
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      for (const lead of filtered) next.add(lead.id);
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDeleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected lead${ids.length === 1 ? "" : "s"}?`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteLeads(ids);
      if (!result.success) {
        alert(result.error);
        return;
      }
      setLeads((prev) => prev.filter((lead) => !ids.includes(lead.id)));
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleDeleteAll() {
    if (leads.length === 0) return;
    if (!confirm(`Delete all ${leads.length} leads? This cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteAllLeads();
      if (!result.success) {
        alert(result.error);
        return;
      }
      setLeads([]);
      setSelected(new Set());
      router.refresh();
    });
  }

  const hasFilter = query.trim().length > 0;

  return (
    <div className={`${cardClassName} overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leads…"
              className={`${inputClassName} pl-10`}
              aria-label="Search leads"
            />
          </div>
          <p className="text-xs text-gray-500">
            <span className="font-semibold tabular-nums text-gray-900">
              {filtered.length}
            </span>{" "}
            of {leads.length}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadCsv(leads, "all")}
            disabled={leads.length === 0}
            className={btnSmSecondaryClassName}
          >
            <Download className="h-4 w-4" />
            Download all
          </button>
          {hasFilter && (
            <button
              type="button"
              onClick={() => downloadCsv(filtered, "filtered")}
              disabled={filtered.length === 0}
              className={btnSmSecondaryClassName}
            >
              <Download className="h-4 w-4" />
              Download filtered
            </button>
          )}
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selected.size === 0 || isPending}
            className={btnSmSecondaryClassName}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete selected{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
          <button
            type="button"
            onClick={handleDeleteAll}
            disabled={leads.length === 0 || isPending}
            className={btnSmSecondaryClassName}
          >
            Delete all
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-14 text-center sm:px-6">
          <p className="text-sm font-medium text-gray-700">No leads found</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          <li className="flex items-center gap-3 bg-gray-50/80 px-5 py-2.5 sm:px-6">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              aria-label="Select all visible leads"
            />
            <span className="text-xs font-medium text-gray-500">Select all</span>
          </li>
          {filtered.map((lead) => (
            <li
              key={lead.id}
              className="px-5 py-4 transition-colors hover:bg-gray-50/60 sm:px-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-1 gap-3.5">
                  <input
                    type="checkbox"
                    checked={selected.has(lead.id)}
                    onChange={() => toggleOne(lead.id)}
                    className="mt-3 h-4 w-4 shrink-0 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    aria-label={`Select ${lead.name}`}
                  />
                  <LeadAvatar name={lead.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">{lead.name}</p>
                      {lead.email && (
                        <EmailVerificationBadge
                          status={lead.emailVerificationStatus}
                        />
                      )}
                      {lead.followUpsPaused && (
                        <FollowUpStoppedBadge
                          reason={lead.followUpsPausedReason}
                        />
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-600">{lead.role}</p>
                    <div className="mt-1.5">
                      <IntentSignalsBadge
                        score={lead.intentScore}
                        signals={lead.intentSignals}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {lead.company}
                      </span>
                      {lead.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          {lead.location}
                        </span>
                      )}
                    </div>
                    {lead.email ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-700">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="break-all">{lead.email}</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  {lead.leadScore !== null && (
                    <LeadScoreBadge score={lead.leadScore} />
                  )}
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <GenerateEmailButton
                      contactId={lead.id}
                      leadName={lead.name}
                      hasEmail={Boolean(lead.email)}
                      followUpsPaused={lead.followUpsPaused}
                      iconOnly
                    />
                    {isValidPersonLinkedInUrl(lead.linkedin) && (
                      <a
                        href={lead.linkedin!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={btnIconSmSecondaryClassName}
                        aria-label="Open LinkedIn profile"
                        title="LinkedIn"
                      >
                        <LinkedInIcon className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
