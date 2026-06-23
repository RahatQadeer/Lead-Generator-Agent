"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import {
  OutreachStepPanel,
} from "@/components/ui/OutreachStepPanel";
import { StepActionButton } from "@/components/search/StepActionButton";
import { StepEmptyNotice, StepErrorAlert } from "@/components/search/StepFeedback";
import {
  DiscoveryProgressPanel,
  type DiscoveryProgressState,
} from "@/components/search/DiscoveryProgressPanel";
import { getNoContactsMessage, getRelaxedContactsNotice } from "@/lib/ui/user-messages";
import type { PersonPublicView } from "@/lib/pipeline/public-views";
import {
  DiscoveryItemDetailModal,
  type DiscoveryDetailItem,
} from "@/components/search/DiscoveryItemDetailModal";
import { PreviewResultRow } from "@/components/search/PreviewResultRow";
import {
  DiscoveryLoadMoreButton,
  DiscoveryResultsToolbar,
} from "@/components/search/DiscoveryResultsToolbar";
import { CONTACT_DISCOVERY_STAGES } from "@/lib/ui/discovery-stages";
import {
  DISCOVERY_DISPLAY_BATCH,
  filterContacts,
  sortContacts,
  type ContactFilterKey,
  type ContactSortKey,
} from "@/lib/ui/discovery-results-utils";
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

const CONTACT_SORT_OPTIONS = [
  { value: "relevance", label: "Best relevance" },
  { value: "name", label: "Name (A–Z)" },
  { value: "company", label: "Company (A–Z)" },
] as const;

const CONTACT_FILTER_OPTIONS = [
  { value: "all", label: "All people" },
  { value: "title_match", label: "Exact title match" },
  { value: "linkedin", label: "Has LinkedIn" },
  { value: "alt_only", label: "Alt. decision-makers" },
] as const;

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
  const [contacts, setContacts] = useState<PersonPublicView[]>([]);
  const [visibleCount, setVisibleCount] = useState(DISCOVERY_DISPLAY_BATCH);
  const [sortBy, setSortBy] = useState<ContactSortKey>("relevance");
  const [filterBy, setFilterBy] = useState<ContactFilterKey>("all");
  const [progress, setProgress] = useState<DiscoveryProgressState | null>(null);
  const [detailItem, setDetailItem] = useState<DiscoveryDetailItem | null>(null);
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
    setContacts([]);
    setVisibleCount(DISCOVERY_DISPLAY_BATCH);
    setSortBy("relevance");
    setFilterBy("all");
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

        setContacts(aggregated);
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

  const processedContacts = useMemo(
    () => filterContacts(sortContacts(contacts, sortBy), filterBy),
    [contacts, sortBy, filterBy]
  );

  const displayedContacts = processedContacts.slice(0, visibleCount);
  const canLoadMore = visibleCount < processedContacts.length;

  function handleSortChange(value: string) {
    setSortBy(value as ContactSortKey);
    setVisibleCount(DISCOVERY_DISPLAY_BATCH);
  }

  function handleFilterChange(value: string) {
    setFilterBy(value as ContactFilterKey);
    setVisibleCount(DISCOVERY_DISPLAY_BATCH);
  }

  function loadMore() {
    setVisibleCount((count) => count + DISCOVERY_DISPLAY_BATCH);
  }

  const activeProgress: DiscoveryProgressState = {
    ...(progress ?? {}),
    stage: rotatingStage,
    foundCount: progress?.foundCount ?? contacts.length,
  };

  const relaxedMatch = result?.meta?.relaxedMatch;

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

      {result?.success && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span>{result.meta?.companyCount ?? 0} companies searched</span>
            {(result.meta?.companiesWithContacts ?? 0) > 0 && (
              <span>
                {result.meta?.companiesWithContacts} of {result.meta?.companyCount ?? 0}{" "}
                companies with people
              </span>
            )}
            <span>{contacts.length} people found</span>
            <span>{contacts.length} saved for enrichment</span>
            {(result.meta?.parsedCount ?? 0) > 0 && (
              <span>{result.meta?.parsedCount} on company websites</span>
            )}
            {(result.meta?.filteredCount ?? 0) > 0 &&
              !result.meta?.relaxedMatch &&
              contacts.length === 0 && (
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
          <p className="text-xs text-gray-400">
            Relevance % reflects job title match to your search, plus LinkedIn or email found on
            the company site.
          </p>

          {relaxedMatch && contacts.length > 0 && (
            <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              {getRelaxedContactsNotice({
                jobTitles: result.meta?.jobTitles,
                companyCount: result.meta?.companyCount,
                companiesWithContacts: result.meta?.companiesWithContacts,
              })}
            </p>
          )}

          {contacts.length === 0 ? (
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
            <>
              <DiscoveryResultsToolbar
                sortValue={sortBy}
                sortOptions={[...CONTACT_SORT_OPTIONS]}
                onSortChange={handleSortChange}
                filterValue={filterBy}
                filterOptions={
                  relaxedMatch
                    ? [...CONTACT_FILTER_OPTIONS]
                    : CONTACT_FILTER_OPTIONS.filter((option) => option.value !== "alt_only")
                }
                onFilterChange={handleFilterChange}
                shownCount={displayedContacts.length}
                totalCount={processedContacts.length}
                totalLoadedLabel={
                  processedContacts.length < contacts.length
                    ? `${contacts.length} total before filters`
                    : undefined
                }
              />

              {processedContacts.length === 0 ? (
                <StepEmptyNotice message="No people match the current filter. Try “All people” or a different sort." />
              ) : (
                <ul className="space-y-2">
                  {displayedContacts.map((contact) => (
                    <PreviewResultRow
                      key={`${contact.companyId}-${contact.id}`}
                      onClick={() => setDetailItem({ kind: "person", data: contact })}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words text-sm font-medium text-gray-900">
                            {contact.fullName}
                          </p>
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                            {contact.confidenceScore}% relevance
                          </span>
                          {relaxedMatch && contact.titleMatched === false && (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-800">
                              Alt. decision-maker
                            </span>
                          )}
                          {contact.linkedinUrl && (
                            <a
                              href={contact.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 hover:bg-sky-100"
                            >
                              LinkedIn
                            </a>
                          )}
                        </div>
                        <p className="break-words text-xs text-gray-500">
                          {contact.title}
                          {contact.department ? ` · ${contact.department}` : ""}
                          {" · "}
                          {contact.companyName}
                        </p>
                      </div>
                    </PreviewResultRow>
                  ))}
                </ul>
              )}

              {canLoadMore && processedContacts.length > 0 && (
                <DiscoveryLoadMoreButton
                  onClick={loadMore}
                  label="Show more people"
                />
              )}
            </>
          )}
        </div>
      )}

      <DiscoveryItemDetailModal
        item={detailItem}
        onClose={() => setDetailItem(null)}
      />
    </OutreachStepPanel>
  );
}
