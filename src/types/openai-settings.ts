import type { EmailGenerationProviderName } from "@/lib/email-generation/factory";

export type OpenAIKeySource = "user" | "environment" | "none";

export interface OpenAISettings {
  generationProvider: EmailGenerationProviderName;
  model: string;
  apiKey: string | null;
  updatedAt: string;
}

export interface OpenAISettingsStatus {
  generationProvider: EmailGenerationProviderName;
  effectiveProvider: EmailGenerationProviderName;
  model: string;
  apiKeyConfigured: boolean;
  apiKeyPreview: string | null;
  keySource: OpenAIKeySource;
  hasUserSettings: boolean;
}

export interface OpenAISettingsInput {
  generationProvider: EmailGenerationProviderName;
  model: string;
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface OpenAITestResult {
  success: boolean;
  message: string;
  model?: string;
}
