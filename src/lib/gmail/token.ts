import { EmailSendingError } from "@/lib/email-sending/errors";
import { getGoogleOAuthCredentials } from "@/lib/email-sending/factory";
import {
  getGmailConnection,
  updateGmailAccessToken,
} from "@/lib/gmail/connection";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

function isTokenValid(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now() + 60_000;
}

export async function getValidGmailAccessToken(
  userId: string
): Promise<string> {
  const credentials = getGoogleOAuthCredentials();
  if (!credentials) {
    throw new EmailSendingError(
      "GMAIL_NOT_CONFIGURED",
      "Google OAuth credentials are not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      { statusCode: 500, retryable: false }
    );
  }

  const connection = await getGmailConnection(userId);
  if (!connection?.refresh_token) {
    throw new EmailSendingError(
      "GMAIL_NOT_CONNECTED",
      "Gmail is not connected. Sign in again with Google from Settings to grant send access.",
      { statusCode: 400, retryable: false }
    );
  }

  if (connection.access_token && isTokenValid(connection.token_expires_at)) {
    return connection.access_token;
  }

  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: connection.refresh_token,
        grant_type: "refresh_token",
      }),
    });
  } catch (error) {
    throw new EmailSendingError(
      "NETWORK_ERROR",
      "Failed to refresh Gmail access token.",
      { statusCode: 502, retryable: true, cause: error }
    );
  }

  const body = (await response.json()) as TokenResponse;

  if (!response.ok || !body.access_token) {
    throw new EmailSendingError(
      "SEND_FAILED",
      body.error_description ?? body.error ?? "Failed to refresh Gmail access token.",
      { statusCode: 502, retryable: false }
    );
  }

  const expiresAt = new Date(
    Date.now() + (body.expires_in ?? 3600) * 1000
  ).toISOString();

  await updateGmailAccessToken(userId, body.access_token, expiresAt);

  return body.access_token;
}
