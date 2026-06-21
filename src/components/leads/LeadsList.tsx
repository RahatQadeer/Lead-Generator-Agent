import { Building2, Link2, MapPin } from "lucide-react";
import { EmailVerificationBadge } from "@/components/leads/EmailVerificationBadge";
import { GenerateEmailButton } from "@/components/leads/GenerateEmailButton";
import { FollowUpStoppedBadge } from "@/components/emails/FollowUpStoppedBadge";
import { LeadScoreBadge } from "@/components/leads/LeadScoreBadge";
import type { EnrichedLead } from "@/types/lead";

interface LeadsListProps {
  leads: EnrichedLead[];
}

export function LeadsList({ leads }: LeadsListProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        {leads.length} enriched lead{leads.length === 1 ? "" : "s"}
      </p>
      <ul className="space-y-3">
        {leads.map((lead) => (
          <li
            key={lead.id}
            className="rounded-xl border border-white/10 bg-slate-900/50 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-white">{lead.name}</p>
                  <LeadScoreBadge score={lead.leadScore} />
                  {lead.followUpsPaused && (
                    <FollowUpStoppedBadge reason={lead.followUpsPausedReason} />
                  )}
                </div>
                <p className="text-sm text-violet-300">{lead.role}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 shrink-0" />
                    {lead.company}
                  </span>
                  {lead.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {lead.location}
                    </span>
                  )}
                </div>
                {lead.email && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-slate-500">{lead.email}</p>
                    <EmailVerificationBadge status={lead.emailVerificationStatus} />
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <GenerateEmailButton
                  contactId={lead.id}
                  leadName={lead.name}
                  hasEmail={Boolean(lead.email)}
                  followUpsPaused={lead.followUpsPaused}
                />
                {lead.linkedin && (
                  <a
                    href={lead.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
