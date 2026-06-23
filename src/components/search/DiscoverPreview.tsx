"use client";

import { useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import {
  OutreachStepPanel,
} from "@/components/ui/OutreachStepPanel";
import { StepActionButton } from "@/components/search/StepActionButton";
import { StepEmptyNotice, StepErrorAlert } from "@/components/search/StepFeedback";
import {
  DiscoveryProgressPanel,
  type DiscoveryProgressState,
} from "@/components/search/DiscoveryProgressPanel";
import { PatienceDiscoveryModal } from "@/components/search/PatienceDiscoveryModal";
import {
  DiscoveryItemDetailModal,
  type DiscoveryDetailItem,
} from "@/components/search/DiscoveryItemDetailModal";
import { PreviewResultRow } from "@/components/search/PreviewResultRow";
import {
  DiscoveryLoadMoreButton,
  DiscoveryResultsToolbar,
} from "@/components/search/DiscoveryResultsToolbar";
import { COMPANY_DISCOVERY_STAGES } from "@/lib/ui/discovery-stages";
import {
  DISCOVERY_DISPLAY_BATCH,
  filterCompanies,
  sortCompanies,
  type CompanyFilterKey,
  type CompanySortKey,
} from "@/lib/ui/discovery-results-utils";
import {
  getNoCompaniesMessage,
  formatDiscoverSummary,
} from "@/lib/ui/user-messages";
import type { CompanyPublicView } from "@/lib/pipeline/public-views";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { useRotatingStage } from "@/hooks/useRotatingStage";
import {
  isStepActionDisabled,
  type OutreachStepControlProps,
} from "@/components/search/step-control";

interface DiscoverPreviewProps extends OutreachStepControlProps {
  searchId: string;
  searchName: string;
}

interface DiscoverResponse {
  success: boolean;
  provider?: string;
  companies?: CompanyPublicView[];
  rejected?: Array<{
    name: string;
    domain: string | null;
    companyType: string;
    reasons: string[];
  }>;
  pagination?: {
    page: number;
    perPage: number;
    totalEntries: number;
    totalPages: number;
    hasMore: boolean;
  };
  meta?: {
    filteredCount: number;
    excludedCount: number;
    duplicateCount: number;
    batchDuplicateCount: number;
    knownDuplicateCount: number;
    seedCount?: number;
    enrichedCount?: number;
    relaxedMatch?: boolean;
    rejected?: Array<{
      name: string;
      domain: string | null;
      companyType: string;
      reasons: string[];
    }>;
    rejectedCount?: number;
    attempts: number;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

const PER_PAGE = 50;

const COMPANY_SORT_OPTIONS = [
  { value: "fit", label: "Best match" },
  { value: "confidence", label: "Data confidence" },
  { value: "name", label: "Name (A–Z)" },
] as const;

const COMPANY_FILTER_OPTIONS = [
  { value: "all", label: "All results" },
  { value: "strong_fit", label: "Strong match (70%+ fit)" },
] as const;

function mergeCompanies(
  existing: CompanyPublicView[],
  incoming: CompanyPublicView[]
): CompanyPublicView[] {
  const seen = new Set(existing.map((company) => company.id));
  const merged = [...existing];
  for (const company of incoming) {
    if (seen.has(company.id)) continue;
    seen.add(company.id);
    merged.push(company);
  }
  return merged;
}

export function DiscoverPreview({
  searchId,
  searchName,
  stepControl,
  onStepComplete,
}: DiscoverPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [result, setResult] = useState<DiscoverResponse | null>(null);
  const [companies, setCompanies] = useState<CompanyPublicView[]>([]);
  const [loadedPage, setLoadedPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [visibleCount, setVisibleCount] = useState(DISCOVERY_DISPLAY_BATCH);
  const [sortBy, setSortBy] = useState<CompanySortKey>("fit");
  const [filterBy, setFilterBy] = useState<CompanyFilterKey>("all");
  const [progress, setProgress] = useState<DiscoveryProgressState | null>(null);
  const [showPatienceModal, setShowPatienceModal] = useState(false);
  const [detailItem, setDetailItem] = useState<DiscoveryDetailItem | null>(null);
  const elapsedSeconds = useElapsedSeconds(loading);
  const rotatingStage = useRotatingStage(COMPANY_DISCOVERY_STAGES, loading);

  async function fetchDiscoveryPage(page: number): Promise<DiscoverResponse> {
    const res = await fetch("/api/companies/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchId, page, perPage: PER_PAGE }),
    });
    return (await res.json()) as DiscoverResponse;
  }

  function applyPageResponse(
    data: DiscoverResponse,
    page: number,
    reset: boolean,
    previous: CompanyPublicView[]
  ) {
    const incoming = data.companies ?? [];
    const merged = reset ? incoming : mergeCompanies(previous, incoming);

    setCompanies(merged);
    setLoadedPage(page);
    setHasMore(Boolean(data.pagination?.hasMore));
    setTotalEntries(data.pagination?.totalEntries ?? merged.length);
    setTotalPages(data.pagination?.totalPages ?? 1);
    setResult({
      ...data,
      companies: merged,
      pagination: data.pagination
        ? { ...data.pagination, page }
        : undefined,
    });

    if (reset) {
      setVisibleCount(DISCOVERY_DISPLAY_BATCH);
      setSortBy("fit");
      setFilterBy("all");
    }
  }

  async function runDiscovery() {
    setLoading(true);
    setResult(null);
    setCompanies([]);
    setLoadedPage(0);
    setHasMore(false);
    setProgress({ foundCount: 0 });

    try {
      const data = await fetchDiscoveryPage(1);

      if (!data.success) {
        setResult(data);
        return;
      }

      applyPageResponse(data, 1, true, []);

      if ((data.companies?.length ?? 0) > 0) {
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

  async function loadMore() {
    const processed = filterCompanies(sortCompanies(companies, sortBy), filterBy);

    if (visibleCount < processed.length) {
      setVisibleCount((count) => count + DISCOVERY_DISPLAY_BATCH);
      return;
    }

    if (!hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      const nextPage = loadedPage + 1;
      const data = await fetchDiscoveryPage(nextPage);

      if (!data.success) {
        setResult((previous) =>
          previous
            ? { ...previous, success: false, error: data.error }
            : data
        );
        return;
      }

      applyPageResponse(data, nextPage, false, companies);
      setVisibleCount((count) => count + DISCOVERY_DISPLAY_BATCH);
    } catch {
      setResult((previous) =>
        previous
          ? {
              ...previous,
              success: false,
              error: {
                code: "NETWORK_ERROR",
                message: "Network error",
                retryable: true,
              },
            }
          : null
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const processedCompanies = useMemo(
    () => filterCompanies(sortCompanies(companies, sortBy), filterBy),
    [companies, sortBy, filterBy]
  );

  const displayedCompanies = processedCompanies.slice(0, visibleCount);
  const canLoadMore =
    visibleCount < processedCompanies.length || hasMore;

  const activeProgress: DiscoveryProgressState = {
    ...(progress ?? {}),
    stage: rotatingStage,
    foundCount: progress?.foundCount ?? companies.length,
  };

  function handleFindCompaniesClick() {
    if (loading) return;
    setShowPatienceModal(true);
  }

  function handleStartDiscovery() {
    setShowPatienceModal(false);
    void runDiscovery();
  }

  function handleSortChange(value: string) {
    setSortBy(value as CompanySortKey);
    setVisibleCount(DISCOVERY_DISPLAY_BATCH);
  }

  function handleFilterChange(value: string) {
    setFilterBy(value as CompanyFilterKey);
    setVisibleCount(DISCOVERY_DISPLAY_BATCH);
  }

  return (
    <OutreachStepPanel
      step={1}
      title="Find companies"
      icon={Building2}
      stepControl={stepControl}
      action={
        <StepActionButton
          icon={Building2}
          label="Find companies"
          loading={loading}
          loadingLabel="Discovering companies"
          onClick={handleFindCompaniesClick}
          disabled={isStepActionDisabled(loading)}
        />
      }
    >
      <PatienceDiscoveryModal
        open={showPatienceModal}
        onClose={() => setShowPatienceModal(false)}
        onStart={handleStartDiscovery}
      />

      {loading && (
        <DiscoveryProgressPanel
          title="Finding companies"
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
          {(companies.length > 0 || (result.meta?.seedCount ?? 0) > 0) && (
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              {totalEntries > 0 && (
                <>
                  <span>
                    {totalEntries} companies found
                    {loadedPage > 0 ? ` · loaded page ${loadedPage} of ${totalPages}` : ""}
                  </span>
                  {(result.meta?.seedCount ?? 0) > 0 && (
                    <span>{result.meta!.seedCount} candidates searched</span>
                  )}
                  {formatDiscoverSummary(result.meta).map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </>
              )}
            </div>
          )}

          {companies.length === 0 && !loading && (
            <StepEmptyNotice message={getNoCompaniesMessage(result.meta)} />
          )}

          {companies.length > 0 && (
            <>
              <DiscoveryResultsToolbar
                sortValue={sortBy}
                sortOptions={[...COMPANY_SORT_OPTIONS]}
                onSortChange={handleSortChange}
                filterValue={filterBy}
                filterOptions={[...COMPANY_FILTER_OPTIONS]}
                onFilterChange={handleFilterChange}
                shownCount={displayedCompanies.length}
                totalCount={processedCompanies.length}
                totalLoadedLabel={
                  processedCompanies.length < companies.length
                    ? `${companies.length} loaded before filters`
                    : undefined
                }
              />

              {processedCompanies.length === 0 ? (
                <StepEmptyNotice message="No companies match the current filter. Try “All results” or a different sort." />
              ) : (
                <ul className="space-y-2">
                  {displayedCompanies.map((company) => (
                    <PreviewResultRow
                      key={company.id}
                      onClick={() => setDetailItem({ kind: "company", data: company })}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words text-sm font-medium text-gray-900">
                            {company.name}
                          </p>
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                            {company.fitScore}% fit
                          </span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                            {company.confidenceScore}% data
                          </span>
                        </div>
                        <p className="break-words text-xs text-gray-500">
                          {company.website ?? company.domain ?? "—"}
                          {company.industry ? ` · ${company.industry}` : ""}
                          {company.location ? ` · ${company.location}` : ""}
                          {company.employeeRange && ` · ${company.employeeRange} employees`}
                        </p>
                        {company.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                            {company.description}
                          </p>
                        )}
                      </div>
                    </PreviewResultRow>
                  ))}
                </ul>
              )}

              {canLoadMore && processedCompanies.length > 0 && (
                <DiscoveryLoadMoreButton
                  onClick={() => void loadMore()}
                  loading={loadingMore}
                  label={
                    visibleCount < processedCompanies.length
                      ? "Show more results"
                      : hasMore
                        ? `Load page ${loadedPage + 1} of ${totalPages}`
                        : "Load more"
                  }
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
