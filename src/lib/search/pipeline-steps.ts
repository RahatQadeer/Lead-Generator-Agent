import type {
  SearchPipelineProgress,
  SearchPipelineStepStates,
} from "@/types/search-pipeline";

export const EMPTY_PIPELINE_PROGRESS: SearchPipelineProgress = {
  companyCount: 0,
  contactCount: 0,
  enrichedCount: 0,
  verifiedCount: 0,
  scoredCount: 0,
  emailLeadCount: 0,
};

export function derivePipelineStepStates(
  progress: SearchPipelineProgress
): SearchPipelineStepStates {
  const step1Complete = progress.companyCount > 0;
  const step2Complete = progress.contactCount > 0;
  const step3Complete = progress.enrichedCount > 0;
  const verifyRequired = progress.emailLeadCount > 0;
  const step4Complete = verifyRequired
    ? progress.verifiedCount > 0
    : step3Complete;
  const step5Complete = progress.scoredCount > 0;

  return {
    step1: {
      enabled: true,
      complete: step1Complete,
    },
    step2: {
      enabled: step1Complete,
      complete: step2Complete,
      lockedReason: step1Complete
        ? undefined
        : "Complete step 1 and save companies before finding people.",
    },
    step3: {
      enabled: step2Complete,
      complete: step3Complete,
      lockedReason: step2Complete
        ? undefined
        : "Complete step 2 and save people before adding contact details.",
    },
    step4: {
      enabled: step3Complete && verifyRequired,
      complete: step4Complete,
      skipped: step3Complete && !verifyRequired,
      skippedReason:
        step3Complete && !verifyRequired
          ? "No email leads in this search — continue to step 5."
          : undefined,
      lockedReason: !step3Complete
        ? "Complete step 3 before checking emails."
        : verifyRequired
          ? undefined
          : "No email leads to verify.",
    },
    step5: {
      enabled: step3Complete && (verifyRequired ? step4Complete : true),
      complete: step5Complete,
      lockedReason: !step3Complete
        ? "Complete step 3 before ranking leads."
        : verifyRequired && !step4Complete
          ? "Complete step 4 before ranking leads."
          : undefined,
    },
  };
}
