import type {
  FollowUpGenerationContext,
  GeneratedFollowUpSuggestion,
} from "@/types/follow-up-suggestion";

export interface FollowUpGenerationProvider {
  readonly name: string;
  readonly model: string | null;
  generate(context: FollowUpGenerationContext): Promise<GeneratedFollowUpSuggestion>;
}
