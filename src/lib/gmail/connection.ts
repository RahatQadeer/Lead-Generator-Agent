import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type GmailConnectionRow = Database["public"]["Tables"]["gmail_connections"]["Row"];
type Supabase = SupabaseClient<Database>;

async function getClient(supabase?: Supabase): Promise<Supabase> {
  return supabase ?? (await createClient());
}

export async function getGmailConnection(
  userId: string
): Promise<GmailConnectionRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gmail_connections")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return data;
}

export async function saveGmailConnection(
  userId: string,
  input: {
    gmailAddress: string;
    refreshToken: string;
    accessToken?: string | null;
    tokenExpiresAt?: string | null;
  },
  supabase?: Supabase
): Promise<void> {
  const client = await getClient(supabase);

  const { error } = await client.from("gmail_connections").upsert(
    {
      user_id: userId,
      gmail_address: input.gmailAddress,
      refresh_token: input.refreshToken,
      access_token: input.accessToken ?? null,
      token_expires_at: input.tokenExpiresAt ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Failed to save Gmail connection:", error.message);
  }
}

export async function deleteGmailConnection(userId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("gmail_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete Gmail connection:", error.message);
  }
}

export async function updateGmailAccessToken(
  userId: string,
  accessToken: string,
  expiresAt: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("gmail_connections")
    .update({
      access_token: accessToken,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update Gmail access token:", error.message);
  }
}
