export interface SearchPipelineProgress {
  companyCount: number;
  contactCount: number;
  enrichedCount: number;
  verifiedCount: number;
  scoredCount: number;
  emailLeadCount: number;
}

export interface PipelineStepControl {
  enabled: boolean;
  complete: boolean;
  lockedReason?: string;
  skipped?: boolean;
  skippedReason?: string;
}

export interface SearchPipelineStepStates {
  step1: PipelineStepControl;
  step2: PipelineStepControl;
  step3: PipelineStepControl;
  step4: PipelineStepControl;
  step5: PipelineStepControl;
}
