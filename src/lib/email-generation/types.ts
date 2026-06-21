import type {
  EmailGenerationContext,
  GeneratedEmail,
} from "@/types/email-generation";

export interface EmailGenerationProvider {
  readonly name: string;
  readonly model: string | null;
  generate(context: EmailGenerationContext): Promise<GeneratedEmail>;
}
