"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Mail, Search } from "lucide-react";
import { EmailDraftCard } from "@/components/emails/EmailDraftCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { inputClassName } from "@/components/ui/Field";
import { iconTileSmClassName } from "@/lib/ui/styles";
import type { SenderProfile } from "@/lib/profile/initials";
import type { SavedEmail } from "@/types/email-generation";
import type { EmailSendingProviderName } from "@/types/email-sending";

const PREVIEW_COUNT = 3;

interface EmailDraftsSectionProps {
  emails: SavedEmail[];
  sendingProvider: EmailSendingProviderName;
  sender: SenderProfile;
}

function matchesQuery(email: SavedEmail, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const { personalization } = email;
  const haystack = [
    personalization.leadName,
    personalization.leadRole,
    personalization.leadCompany,
    personalization.industry ?? "",
    email.recipientEmail ?? "",
    email.subject,
    email.status,
    email.replyStatus,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export function EmailDraftsSection({
  emails,
  sendingProvider,
  sender,
}: EmailDraftsSectionProps) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(
    () => emails.filter((email) => matchesQuery(email, query)),
    [emails, query]
  );

  useEffect(() => {
    setExpanded(false);
  }, [query]);

  const hasMore = filtered.length > PREVIEW_COUNT;
  const visible =
    expanded || !hasMore ? filtered : filtered.slice(0, PREVIEW_COUNT);
  const hiddenCount = Math.max(0, filtered.length - PREVIEW_COUNT);

  return (
    <SectionCard title="Email drafts" padContent={false} className="overflow-hidden">
      {emails.length === 0 ? (
        <div className="border-t border-gray-100 px-5 py-14 text-center sm:px-6">
          <div className={`${iconTileSmClassName} mx-auto`}>
            <Mail className="h-4 w-4" />
          </div>
          <p className="mt-4 text-sm font-medium text-gray-700">No emails yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-gray-500">
            Generate outreach from the Leads page after enriching contacts.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, company, subject…"
                className={`${inputClassName} pl-10`}
                aria-label="Search email drafts"
              />
            </div>
            <p className="shrink-0 text-xs text-gray-500">
              <span className="font-semibold tabular-nums text-gray-900">
                {filtered.length}
              </span>{" "}
              of {emails.length} shown
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center sm:px-6">
              <p className="text-sm font-medium text-gray-700">
                No drafts match your search
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Try a different name, company, or subject
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {visible.map((email) => (
                  <li key={email.id} className="px-5 py-5 sm:px-6">
                    <EmailDraftCard
                      email={email}
                      sendingProvider={sendingProvider}
                      sender={sender}
                    />
                  </li>
                ))}
              </ul>

              {hasMore && (
                <div className="border-t border-gray-100 px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => !prev)}
                    aria-expanded={expanded}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-100 py-2.5 text-sm font-medium text-gray-600 transition-colors duration-200 hover:bg-gray-50 hover:text-gray-900"
                  >
                    {expanded ? (
                      <>
                        Show less
                        <ChevronDown className="h-4 w-4 rotate-180 transition-transform duration-200" />
                      </>
                    ) : (
                      <>
                        Show {hiddenCount} more
                        <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </SectionCard>
  );
}
