import { maskApiKey } from "@/lib/openai/mask-key";
import {
  getConfiguredEmailProviderName,
  getOpenAIModel,
  type EmailGenerationProviderName,
} from "@/lib/email-generation/factory";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  OpenAIKeySource,
  OpenAISettings,
  OpenAISettingsInput,
  OpenAISettingsStatus,
} from "@/types/openai-settings";

type OpenAISettingsRow = Database["public"]["Tables"]["openai_settings"]["Row"];

export interface ResolvedEmailGenerationConfig {
  provider: EmailGenerationProviderName;
  apiKey: string | null;
  model: string;
  keySource: OpenAIKeySource;
}

function parseProvider(value: string): EmailGenerationProviderName {
  return value === "openai" ? "openai" : "mock";
}

function toSettings(row: OpenAISettingsRow): OpenAISettings {
  return {
    generationProvider: parseProvider(row.generation_provider),
    model: row.model,
    apiKey: row.api_key,
    updatedAt: row.updated_at,
  };
}

export async function getOpenAISettings(
  userId: string
): Promise<OpenAISettings | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("openai_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return toSettings(data);
}

export async function saveOpenAISettings(
  userId: string,
  input: OpenAISettingsInput
): Promise<OpenAISettings | null> {
  const supabase = await createClient();
  const existing = await getOpenAISettings(userId);
  const updatedAt = new Date().toISOString();

  const apiKey = input.clearApiKey
    ? null
    : input.apiKey?.trim()
      ? input.apiKey.trim()
      : (existing?.apiKey ?? null);

  const { data, error } = await supabase
    .from("openai_settings")
    .upsert(
      {
        user_id: userId,
        generation_provider: input.generationProvider,
        model: input.model.trim() || getOpenAIModel(),
        api_key: apiKey,
        updated_at: updatedAt,
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to save OpenAI settings:", error?.message);
    return null;
  }

  return toSettings(data);
}

export async function deleteOpenAISettings(userId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("openai_settings")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete OpenAI settings:", error.message);
  }
}

function resolveApiKey(userSettings: OpenAISettings | null): {
  apiKey: string | null;
  keySource: OpenAIKeySource;
} {
  if (userSettings?.apiKey) {
    return { apiKey: userSettings.apiKey, keySource: "user" };
  }

  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) {
    return { apiKey: envKey, keySource: "environment" };
  }

  return { apiKey: null, keySource: "none" };
}

export async function resolveEmailGenerationConfig(
  userId: string
): Promise<ResolvedEmailGenerationConfig> {
  const userSettings = await getOpenAISettings(userId);
  const { apiKey, keySource } = resolveApiKey(userSettings);

  const preferredProvider =
    userSettings?.generationProvider ?? getConfiguredEmailProviderName();
  const model = userSettings?.model?.trim() || getOpenAIModel();

  const provider: EmailGenerationProviderName =
    preferredProvider === "openai" && apiKey ? "openai" : "mock";

  return { provider, apiKey, model, keySource };
}

export async function getOpenAISettingsStatus(
  userId: string
): Promise<OpenAISettingsStatus> {
  const userSettings = await getOpenAISettings(userId);
  const { apiKey, keySource } = resolveApiKey(userSettings);
  const config = await resolveEmailGenerationConfig(userId);

  return {
    generationProvider:
      userSettings?.generationProvider ?? getConfiguredEmailProviderName(),
    effectiveProvider: config.provider,
    model: userSettings?.model?.trim() || getOpenAIModel(),
    apiKeyConfigured: Boolean(apiKey),
    apiKeyPreview: apiKey ? maskApiKey(apiKey) : null,
    keySource,
    hasUserSettings: Boolean(userSettings),
  };
}
