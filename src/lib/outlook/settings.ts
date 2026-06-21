import {
  getConfiguredSendingProviderName,
} from "@/lib/email-sending/factory";
import { getMicrosoftOAuthCredentials } from "@/lib/outlook/oauth";
import { getOutlookConnection } from "@/lib/outlook/connection";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  OutlookSendingProviderPreference,
  OutlookSettings,
  OutlookSettingsStatus,
} from "@/types/outlook-settings";

type OutlookSettingsRow = Database["public"]["Tables"]["outlook_settings"]["Row"];

function parseSendingProvider(value: string): OutlookSendingProviderPreference {
  return value === "outlook" ? "outlook" : "mock";
}

function toSettings(row: OutlookSettingsRow): OutlookSettings {
  return {
    sendingProvider: parseSendingProvider(row.sending_provider),
    updatedAt: row.updated_at,
  };
}

export async function getOutlookSettings(
  userId: string
): Promise<OutlookSettings | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outlook_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return toSettings(data);
}

export async function saveOutlookSettings(
  userId: string,
  sendingProvider: OutlookSendingProviderPreference
): Promise<OutlookSettings | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outlook_settings")
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
    console.error("Failed to save Outlook settings:", error?.message);
    return null;
  }

  return toSettings(data);
}

export async function deleteOutlookSettings(userId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("outlook_settings")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete Outlook settings:", error.message);
  }
}

export async function getOutlookSettingsStatus(
  userId: string,
  fallbackEmail?: string | null
): Promise<OutlookSettingsStatus> {
  const [userSettings, connection] = await Promise.all([
    getOutlookSettings(userId),
    getOutlookConnection(userId),
  ]);

  const envProvider = getConfiguredSendingProviderName();
  const sendingProvider =
    userSettings?.sendingProvider ??
    (envProvider === "outlook" ? "outlook" : "mock");
  const connected = Boolean(connection?.refresh_token);
  const effectiveProvider: OutlookSendingProviderPreference =
    sendingProvider === "outlook" && connected ? "outlook" : "mock";

  return {
    sendingProvider,
    effectiveProvider,
    connected,
    accountAddress: connection?.outlook_address ?? fallbackEmail ?? null,
    connectedAt: connection?.connected_at ?? null,
    oauthConfigured: Boolean(getMicrosoftOAuthCredentials()),
    hasUserSettings: Boolean(userSettings),
    envProvider,
  };
}
