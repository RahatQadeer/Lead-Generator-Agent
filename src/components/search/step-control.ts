import type { PipelineStepControl } from "@/types/search-pipeline";

export interface OutreachStepControlProps {
  stepControl?: PipelineStepControl;
  onStepComplete?: () => void;
}

export function isStepActionDisabled(loading: boolean): boolean {
  return loading;
}

/** Steps 2+ stay disabled until pipeline progress is loaded and the prior step saved data. */
export function isGatedStepActionDisabled(
  loading: boolean,
  stepControl?: PipelineStepControl
): boolean {
  if (loading) return true;
  if (!stepControl) return true;
  return !stepControl.enabled;
}
