import {
  getConfiguredSendingProviderName,
  getGoogleOAuthCredentials,
} from "@/lib/email-sending/factory";
import { getGmailConnection } from "@/lib/gmail/connection";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  GmailSendingProviderPreference,
  GmailSettings,
  GmailSettingsStatus,
} from "@/types/gmail-settings";

type GmailSettingsRow = Database["public"]["Tables"]["gmail_settings"]["Row"];

function parseSendingProvider(value: string): GmailSendingProviderPreference {
  return value === "gmail" ? "gmail" : "mock";
}

function toSettings(row: GmailSettingsRow): GmailSettings {
  return {
    sendingProvider: parseSendingProvider(row.sending_provider),
    updatedAt: row.updated_at,
  };
}

export async function getGmailSettings(
  userId: string
): Promise<GmailSettings | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gmail_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return toSettings(data);
}

export async function saveGmailSettings(
  userId: string,
  sendingProvider: GmailSendingProviderPreference
): Promise<GmailSettings | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gmail_settings")
    .upsert(
      {
        user_id: userId,
        sending_provider: sendingProvider,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to save Gmail settings:", error?.message);
    return null;
  }

  return toSettings(data);
}

export async function deleteGmailSettings(userId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("gmail_settings")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete Gmail settings:", error.message);
  }
}

export async function getGmailSettingsStatus(
  userId: string,
  fallbackEmail?: string | null
): Promise<GmailSettingsStatus> {
  const [userSettings, connection] = await Promise.all([
    getGmailSettings(userId),
    getGmailConnection(userId),
  ]);

  const envProvider = getConfiguredSendingProviderName();
  const sendingProvider =
    userSettings?.sendingProvider ??
    (envProvider === "gmail" ? "gmail" : "mock");
  const connected = Boolean(connection?.refresh_token);
  const effectiveProvider: GmailSendingProviderPreference =
    sendingProvider === "gmail" && connected ? "gmail" : "mock";

  return {
    sendingProvider,
    effectiveProvider,
    connected,
    accountAddress: connection?.gmail_address ?? fallbackEmail ?? null,
    connectedAt: connection?.connected_at ?? null,
    oauthConfigured: Boolean(getGoogleOAuthCredentials()),
    hasUserSettings: Boolean(userSettings),
    envProvider,
  };
}
