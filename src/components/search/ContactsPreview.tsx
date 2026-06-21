"use client";

import { useState } from "react";
import { Users, ChevronRight } from "lucide-react";
import {
  OutreachStepPanel,
} from "@/components/ui/OutreachStepPanel";
import { StepActionButton } from "@/components/search/StepActionButton";
import { StepEmptyNotice, StepErrorAlert } from "@/components/search/StepFeedback";
import {
  DiscoveryProgressPanel,
  type DiscoveryProgressState,
} from "@/components/search/DiscoveryProgressPanel";
import { previewResultItemClassName } from "@/lib/ui/styles";
import { CONTACT_DISCOVERY_STAGES } from "@/lib/ui/discovery-stages";
import { getNoContactsMessage, getRelaxedContactsNotice } from "@/lib/ui/user-messages";
import type { PersonPublicView } from "@/lib/pipeline/public-views";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { useRotatingStage } from "@/hooks/useRotatingStage";
import {
  isGatedStepActionDisabled,
  type OutreachStepControlProps,
} from "@/components/search/step-control";

interface ContactsPreviewProps extends OutreachStepControlProps {
  searchId: string;
  searchName: string;
  jobTitles: string[];
}

interface SearchCompanyRef {
  id: string;
  name: string;
  domain: string | null;
}

interface ContactsDiscoverResponse {
  success: boolean;
  provider?: string;
  contacts?: PersonPublicView[];
  pagination?: {
    page: number;
    perPage: number;
    totalEntries: number;
    totalPages: number;
    hasMore: boolean;
  };
  meta?: {
    companyCount: number;
    jobTitles: string[];
    scrapedCount?: number;
    parsedCount?: number;
    filteredCount: number;
    duplicateCount: number;
    batchDuplicateCount: number;
    knownDuplicateCount: number;
    attempts: number;
    savedCount?: number;
    relaxedMatch?: boolean;
    rejectedCount?: number;
    companiesWithoutDomain?: number;
    companiesWithContacts?: number;
    searxngConfigured?: boolean;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

const PER_PAGE = 25;

function mergeContacts(
  existing: PersonPublicView[],
  incoming: PersonPublicView[]
): PersonPublicView[] {
  const seen = new Set(existing.map((contact) => contact.id));
  const merged = [...existing];
  for (const contact of incoming) {
    if (seen.has(contact.id)) continue;
    seen.add(contact.id);
    merged.push(contact);
  }
  return merged;
}

function mergeDiscoveryMeta(
  previous: ContactsDiscoverResponse["meta"] | undefined,
  incoming: ContactsDiscoverResponse["meta"] | undefined,
  aggregatedContacts: PersonPublicView[],
  totalCompanyCount: number
): ContactsDiscoverResponse["meta"] | undefined {
  if (!incoming) return previous;

  const companiesWithContacts = new Set(
    aggregatedContacts.map((contact) => contact.companyId)
  ).size;

  if (!previous) {
    return {
      ...incoming,
      companyCount: totalCompanyCount,
      companiesWithContacts,
    };
  }

  return {
    ...incoming,
    companyCount: totalCompanyCount,
    companiesWithContacts,
    parsedCount: (previous.parsedCount ?? 0) + (incoming.parsedCount ?? 0),
    filteredCount: (previous.filteredCount ?? 0) + (incoming.filteredCount ?? 0),
    rejectedCount: (previous.rejectedCount ?? 0) + (incoming.rejectedCount ?? 0),
    duplicateCount: (previous.duplicateCount ?? 0) + (incoming.duplicateCount ?? 0),
    batchDuplicateCount:
      (previous.batchDuplicateCount ?? 0) + (incoming.batchDuplicateCount ?? 0),
    knownDuplicateCount:
      (previous.knownDuplicateCount ?? 0) + (incoming.knownDuplicateCount ?? 0),
    savedCount: (previous.savedCount ?? 0) + (incoming.savedCount ?? 0),
    relaxedMatch: previous.relaxedMatch || incoming.relaxedMatch,
    attempts: Math.max(previous.attempts ?? 0, incoming.attempts ?? 0),
  };
}

export function ContactsPreview({
  searchId,
  searchName,
  jobTitles,
  stepControl,
  onStepComplete,
}: ContactsPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContactsDiscoverResponse | null>(null);
  const [progress, setProgress] = useState<DiscoveryProgressState | null>(null);
  const elapsedSeconds = useElapsedSeconds(loading);
  const rotatingStage = useRotatingStage(CONTACT_DISCOVERY_STAGES, loading);

  async function fetchCompanies(): Promise<SearchCompanyRef[]> {
    const res = await fetch(`/api/searches/${searchId}/companies`);
    const data = (await res.json()) as {
      success: boolean;
      companies?: SearchCompanyRef[];
      error?: { message: string };
    };

    if (!data.success || !data.companies) {
      throw new Error(data.error?.message ?? "Failed to load companies");
    }

    return data.companies;
  }

  async function fetchDiscoveryForCompany(
    companyId: string,
    clearExisting: boolean
  ): Promise<ContactsDiscoverResponse> {
    const res = await fetch("/api/contacts/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchId,
        page: 1,
        perPage: PER_PAGE,
        companyIds: [companyId],
        clearExisting,
      }),
    });
    return (await res.json()) as ContactsDiscoverResponse;
  }

  async function runDiscovery() {
    setLoading(true);
    setResult(null);
    setProgress(null);

    try {
      const companies = await fetchCompanies();
      let aggregated: PersonPublicView[] = [];
      let mergedMeta: ContactsDiscoverResponse["meta"] | undefined;
      let lastProvider: string | undefined;

      for (let index = 0; index < companies.length; index += 1) {
        const company = companies[index]!;
        setProgress({
          current: index + 1,
          total: companies.length,
          foundCount: aggregated.length,
          itemLabel: company.name,
        });

        const data = await fetchDiscoveryForCompany(company.id, index === 0);

        if (!data.success) {
          setResult(data);
          return;
        }

        aggregated = mergeContacts(aggregated, data.contacts ?? []);
        mergedMeta = mergeDiscoveryMeta(
          mergedMeta,
          data.meta,
          aggregated,
          companies.length
        );
        lastProvider = data.provider;

        setResult({
          success: true,
          provider: lastProvider,
          contacts: aggregated,
          pagination: {
            page: 1,
            perPage: PER_PAGE,
            totalEntries: aggregated.length,
            totalPages: 1,
            hasMore: false,
          },
          meta: mergedMeta,
        });
      }

      if ((mergedMeta?.savedCount ?? aggregated.length) > 0) {
        onStepComplete?.();
      }
    } catch {
      setResult({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Network error",
          retryable: true,
        },
      });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  const activeProgress: DiscoveryProgressState = {
    ...(progress ?? {}),
    stage: rotatingStage,
    foundCount: progress?.foundCount ?? result?.contacts?.length,
  };

  return (
    <OutreachStepPanel
      step={2}
      title="Find people"
      icon={Users}
      stepControl={stepControl}
      action={
        <StepActionButton
          icon={Users}
          label="Find people"
          loading={loading}
          loadingLabel="Finding people"
          onClick={runDiscovery}
          disabled={isGatedStepActionDisabled(loading, stepControl)}
        />
      }
    >
      {loading && (
        <DiscoveryProgressPanel
          title="Finding people"
          elapsedSeconds={elapsedSeconds}
          progress={activeProgress}
        />
      )}

      {result && !result.success && result.error && (
        <StepErrorAlert
          error={result.error}
          retryable={result.error.retryable}
          onRetry={runDiscovery}
        />
      )}

      {result?.success && result.contacts && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span>{result.meta?.companyCount ?? 0} companies searched</span>
            {(result.meta?.companiesWithContacts ?? 0) > 0 && (
              <span>
                {result.meta?.companiesWithContacts} of {result.meta?.companyCount ?? 0}{" "}
                companies with people
              </span>
            )}
            <span>{result.pagination?.totalEntries ?? result.contacts.length} people found</span>
            <span>{result.contacts.length} saved for enrichment</span>
            {(result.meta?.parsedCount ?? 0) > 0 && (
              <span>{result.meta?.parsedCount} on company websites</span>
            )}
            {(result.meta?.filteredCount ?? 0) > 0 &&
              !result.meta?.relaxedMatch &&
              result.contacts.length === 0 && (
              <span className="text-amber-800">
                {result.meta?.filteredCount} didn&apos;t match{" "}
                {result.meta?.jobTitles?.length
                  ? result.meta.jobTitles.join(", ")
                  : "CEO, CTO, or Founder"}
              </span>
            )}
            {(result.meta?.knownDuplicateCount ?? 0) > 0 && (
              <span className="text-sky-800">
                {result.meta?.knownDuplicateCount} linked from current results
              </span>
            )}
            {(result.meta?.duplicateCount ?? 0) > 0 && (
              <span className="text-violet-800">
                {result.meta?.duplicateCount} duplicate
                {result.meta?.duplicateCount === 1 ? "" : "s"} skipped in this batch
              </span>
            )}
          </div>

          {result.meta?.relaxedMatch && result.contacts.length > 0 && (
            <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              {getRelaxedContactsNotice({
                jobTitles: result.meta?.jobTitles,
                companyCount: result.meta?.companyCount,
                companiesWithContacts: result.meta?.companiesWithContacts,
              })}
            </p>
          )}

          {result.contacts.length === 0 ? (
            <StepEmptyNotice
              message={getNoContactsMessage({
                scrapedCount: result.meta?.scrapedCount,
                parsedCount: result.meta?.parsedCount,
                filteredCount: result.meta?.filteredCount,
                rejectedCount: result.meta?.rejectedCount,
                companyCount: result.meta?.companyCount,
                jobTitles: result.meta?.jobTitles,
                companiesWithoutDomain: result.meta?.companiesWithoutDomain,
                searxngConfigured: result.meta?.searxngConfigured,
              })}
            />
          ) : (
            <ul className="space-y-2">
              {result.contacts.map((contact) => (
                <li
                  key={`${contact.companyId}-${contact.id}`}
                  className={previewResultItemClassName}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-sm font-medium text-gray-900">
                        {contact.fullName}
                      </p>
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                        {contact.confidenceScore}% relevance
                      </span>
                      {result.meta?.relaxedMatch && contact.titleMatched === false && (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-800">
                          Alt. decision-maker
                        </span>
                      )}
                    </div>
                    <p className="break-words text-xs text-gray-500">
                      {contact.title}
                      {contact.department ? ` · ${contact.department}` : ""}
                      {" · "}
                      {contact.companyName}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </OutreachStepPanel>
  );
}
