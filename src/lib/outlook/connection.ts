import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type OutlookConnectionRow =
  Database["public"]["Tables"]["outlook_connections"]["Row"];

export async function getOutlookConnection(
  userId: string
): Promise<OutlookConnectionRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outlook_connections")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return data;
}

export async function saveOutlookConnection(
  userId: string,
  input: {
    outlookAddress: string;
    refreshToken: string;
    accessToken?: string | null;
    tokenExpiresAt?: string | null;
  }
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("outlook_connections").upsert(
    {
      user_id: userId,
      outlook_address: input.outlookAddress,
      refresh_token: input.refreshToken,
      access_token: input.accessToken ?? null,
      token_expires_at: input.tokenExpiresAt ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Failed to save Outlook connection:", error.message);
  }
}

export async function updateOutlookAccessToken(
  userId: string,
  accessToken: string,
  expiresAt: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("outlook_connections")
    .update({
      access_token: accessToken,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update Outlook access token:", error.message);
  }
}
