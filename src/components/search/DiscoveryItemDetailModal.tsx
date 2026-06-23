"use client";

import { ExternalLink, Link2, Mail, MapPin } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { linkClassName } from "@/lib/ui/styles";
import type {
  CompanyPublicView,
  ContactDetailsView,
  PersonPublicView,
} from "@/lib/pipeline/public-views";

export type DiscoveryDetailItem =
  | { kind: "company"; data: CompanyPublicView }
  | { kind: "person"; data: PersonPublicView }
  | { kind: "contact"; data: ContactDetailsView };

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;

  return (
    <div className="border-b border-gray-100 py-3 last:border-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

function linkedInSourceLabel(source: ContactDetailsView["linkedInSource"]): string {
  if (source === "website") return "From company website";
  if (source === "pdl") return "People Data Labs";
  if (source === "public_profile") return "Google/SearXNG search";
  return "";
}

function CompanyDetails({ company }: { company: CompanyPublicView }) {
  return (
    <dl className="px-5 py-4 sm:px-6">
      <DetailRow
        label="Website"
        value={
          company.website ? (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkClassName} inline-flex items-center gap-1 break-all`}
            >
              {company.website.replace(/^https?:\/\/(www\.)?/, "")}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          ) : (
            company.domain ?? "—"
          )
        }
      />
      <DetailRow label="Industry" value={company.industry} />
      <DetailRow label="Location" value={company.location} />
      <DetailRow label="Country" value={company.country} />
      <DetailRow label="Employees" value={company.employeeRange} />
      <DetailRow label="Fit score" value={`${company.fitScore}%`} />
      <DetailRow label="Data confidence" value={`${company.confidenceScore}%`} />
      {company.description && (
        <DetailRow label="About" value={<p className="whitespace-pre-wrap">{company.description}</p>} />
      )}
      {company.scoreReasons.length > 0 && (
        <DetailRow label="Fit factors" value={company.scoreReasons.join(" · ")} />
      )}
      {company.validationWarnings.length > 0 && (
        <DetailRow
          label="Notes"
          value={
            <ul className="list-disc space-y-1 pl-4 text-amber-800">
              {company.validationWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          }
        />
      )}
      {company.companyLinkedIn && (
        <DetailRow
          label="Company LinkedIn"
          value={
            <a
              href={company.companyLinkedIn}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkClassName} inline-flex items-center gap-1 break-all`}
            >
              <Link2 className="h-3.5 w-3.5 shrink-0 text-[#0A66C2]" />
              {company.companyLinkedIn.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          }
        />
      )}
    </dl>
  );
}

function PersonDetails({ person }: { person: PersonPublicView }) {
  return (
    <dl className="px-5 py-4 sm:px-6">
      <DetailRow label="Role" value={person.title} />
      <DetailRow label="Department" value={person.department} />
      <DetailRow label="Company" value={person.companyName} />
      <DetailRow
        label="Relevance"
        value={
          <span>
            {person.confidenceScore}%
            <span className="mt-0.5 block text-xs font-normal text-gray-500">
              Job title match plus LinkedIn or email on the company site.
            </span>
          </span>
        }
      />
      {person.titleMatched === false && (
        <DetailRow label="Title match" value="Alternative decision-maker" />
      )}
      {person.discoverySource && (
        <DetailRow
          label="Found via"
          value={person.discoverySource.replace(/_/g, " ")}
        />
      )}
      {person.sourceUrl && (
        <DetailRow
          label="Source page"
          value={
            <a
              href={person.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkClassName} inline-flex items-center gap-1 break-all`}
            >
              {person.sourceUrl.replace(/^https?:\/\/(www\.)?/, "")}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          }
        />
      )}
      {person.linkedinUrl ? (
        <DetailRow
          label="LinkedIn"
          value={
            <a
              href={person.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkClassName} inline-flex items-center gap-1 break-all`}
            >
              <Link2 className="h-3.5 w-3.5 shrink-0 text-[#0A66C2]" />
              {person.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          }
        />
      ) : (
        <DetailRow
          label="LinkedIn"
          value={<span className="text-gray-400">Not found yet — run contact details step</span>}
        />
      )}
    </dl>
  );
}

function ContactDetails({ lead }: { lead: ContactDetailsView }) {
  return (
    <dl className="px-5 py-4 sm:px-6">
      <DetailRow label="Role" value={`${lead.title} · ${lead.companyName}`} />
      <DetailRow
        label="Confidence"
        value={
          <span>
            {lead.confidenceScore}%
            <span className="mt-0.5 block text-xs font-normal text-gray-500">
              Verified email, LinkedIn, role fit, and company industry match.
            </span>
          </span>
        }
      />
      {lead.outreachChannel && (
        <DetailRow
          label="Outreach channel"
          value={lead.outreachChannel === "linkedin" ? "LinkedIn" : "Email"}
        />
      )}
      <DetailRow
        label="Email"
        value={
          lead.email ? (
            <span className="inline-flex flex-wrap items-center gap-2 break-all">
              <Mail className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span className="font-medium">{lead.email}</span>
              <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                Verified
              </span>
            </span>
          ) : (
            <span className="text-gray-400">No verified email found</span>
          )
        }
      />
      <DetailRow
        label="LinkedIn"
        value={
          lead.personalLinkedIn ? (
            <div className="space-y-1">
              <a
                href={lead.personalLinkedIn}
                target="_blank"
                rel="noopener noreferrer"
                className={`${linkClassName} inline-flex items-center gap-1 break-all`}
              >
                <Link2 className="h-3.5 w-3.5 shrink-0 text-[#0A66C2]" />
                {lead.personalLinkedIn.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
              {lead.linkedInSource && (
                <p className="text-xs text-gray-500">{linkedInSourceLabel(lead.linkedInSource)}</p>
              )}
            </div>
          ) : (
            <span className="text-gray-400">No LinkedIn profile found</span>
          )
        }
      />
      {lead.contactPageUrl && (
        <DetailRow
          label="Contact page"
          value={
            <a
              href={lead.contactPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkClassName} inline-flex items-center gap-1 break-all`}
            >
              {lead.contactPageUrl.replace(/^https?:\/\/(www\.)?/, "")}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          }
        />
      )}
      {lead.location && (
        <DetailRow
          label="Location"
          value={
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              {lead.location}
            </span>
          }
        />
      )}
    </dl>
  );
}

export function DiscoveryItemDetailModal({
  item,
  onClose,
}: {
  item: DiscoveryDetailItem | null;
  onClose: () => void;
}) {
  if (!item) return null;

  const title =
    item.kind === "company"
      ? item.data.name
      : item.kind === "person"
        ? item.data.fullName
        : item.data.fullName;

  const subtitle =
    item.kind === "company"
      ? [item.data.industry, item.data.location].filter(Boolean).join(" · ")
      : item.kind === "person"
        ? `${item.data.title} · ${item.data.companyName}`
        : `${item.data.title} · ${item.data.companyName}`;

  return (
    <Modal open onClose={onClose} title={title} subtitle={subtitle || undefined} size="lg">
      {item.kind === "company" && <CompanyDetails company={item.data} />}
      {item.kind === "person" && <PersonDetails person={item.data} />}
      {item.kind === "contact" && <ContactDetails lead={item.data} />}
    </Modal>
  );
}
