"use client";

import { useMemo, useState } from "react";
import { Building2, Mail, MapPin, Search } from "lucide-react";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";
import { EmailVerificationBadge } from "@/components/leads/EmailVerificationBadge";
import { GenerateEmailButton } from "@/components/leads/GenerateEmailButton";
import { FollowUpStoppedBadge } from "@/components/emails/FollowUpStoppedBadge";
import { LeadScoreBadge } from "@/components/leads/LeadScoreBadge";
import { inputClassName } from "@/components/ui/Field";
import {
  btnIconSmSecondaryClassName,
  cardClassName,
} from "@/lib/ui/styles";
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

export function LeadsList({ leads }: LeadsListProps) {
  const [query, setQuery] = useState("");

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

  return (
    <div className={`${cardClassName} overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, role, company…"
            className={`${inputClassName} pl-10`}
            aria-label="Search leads"
          />
        </div>
        <p className="shrink-0 text-xs text-gray-500">
          <span className="font-semibold tabular-nums text-gray-900">
            {filtered.length}
          </span>{" "}
          of {leads.length} leads
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-14 text-center sm:px-6">
          <p className="text-sm font-medium text-gray-700">
            No leads match your search
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Try a different name, company, or role
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {filtered.map((lead) => (
            <li
              key={lead.id}
              className="px-5 py-4 transition-colors hover:bg-gray-50/60 sm:px-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-1 gap-3.5">
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
                    ) : (
                      <p className="mt-2 text-xs text-gray-400">No email on file</p>
                    )}
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
                  {lead.linkedin && (
                    <a
                      href={lead.linkedin}
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
