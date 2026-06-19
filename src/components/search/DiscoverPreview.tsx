"use client";

import { useState } from "react";
import { Building2, ChevronRight } from "lucide-react";
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
import { previewResultItemClassName } from "@/lib/ui/styles";
import { COMPANY_DISCOVERY_STAGES } from "@/lib/ui/discovery-stages";
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

const PER_PAGE = 10;

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
  const [result, setResult] = useState<DiscoverResponse | null>(null);
  const [progress, setProgress] = useState<DiscoveryProgressState | null>(null);
  const [showPatienceModal, setShowPatienceModal] = useState(false);
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

  async function runDiscovery() {
    setLoading(true);
    setResult(null);
    setProgress({ foundCount: 0 });

    try {
      let page = 1;
      let aggregated: CompanyPublicView[] = [];
      let lastResponse: DiscoverResponse | null = null;
      let totalPages = 1;

      while (true) {
        setProgress({
          current: page,
          total: totalPages,
          foundCount: aggregated.length,
          itemLabel:
            page === 1 ? undefined : `Page ${page} of ${totalPages}`,
        });

        const data = await fetchDiscoveryPage(page);

        if (!data.success) {
          setResult(data);
          return;
        }

        aggregated = mergeCompanies(aggregated, data.companies ?? []);
        totalPages = data.pagination?.totalPages ?? 1;

        lastResponse = {
          ...data,
          companies: aggregated,
          pagination: data.pagination
            ? {
                ...data.pagination,
                page,
                totalPages,
              }
            : undefined,
        };

        setResult(lastResponse);

        if (!data.pagination?.hasMore) {
          if (aggregated.length > 0) {
            onStepComplete?.();
          }
          return;
        }

        page += 1;
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
    stage:
      progress?.current != null && progress.current > 1
        ? `Loading results page ${progress.current} of ${progress.total ?? 1}…`
        : rotatingStage,
    foundCount: progress?.foundCount ?? result?.companies?.length,
  };

  function handleFindCompaniesClick() {
    if (loading) return;
    setShowPatienceModal(true);
  }

  function handleStartDiscovery() {
    setShowPatienceModal(false);
    void runDiscovery();
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

      {result?.success && result.companies && (
        <div className="mt-4 space-y-3">
          {(result.companies.length > 0 ||
            (result.meta?.seedCount ?? 0) > 0) && (
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              {result.companies.length > 0 && (
                <>
                  <span>
                    Page {result.pagination?.page} of {result.pagination?.totalPages}
                  </span>
                  <span>
                    {result.pagination?.totalEntries} companies found
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

          {result.companies.length === 0 && !loading && (
            <StepEmptyNotice message={getNoCompaniesMessage(result.meta)} />
          )}

          {result.companies.length > 0 && (
            <ul className="space-y-2">
              {result.companies.map((company) => (
                <li key={company.id} className={previewResultItemClassName}>
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
                    {company.scoreReasons.length > 0 && (
                      <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
                        {company.scoreReasons.join(" · ")}
                      </p>
                    )}
                    {company.companyLinkedIn && (
                      <a
                        href={company.companyLinkedIn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block truncate text-xs text-blue-600 hover:underline"
                      >
                        Company LinkedIn
                      </a>
                    )}
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
