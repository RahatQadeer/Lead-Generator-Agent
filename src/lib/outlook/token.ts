import { EmailSendingError } from "@/lib/email-sending/errors";
import {
  getMicrosoftOAuthCredentials,
  getMicrosoftTenantId,
} from "@/lib/outlook/oauth";
import {
  getOutlookConnection,
  updateOutlookAccessToken,
} from "@/lib/outlook/connection";

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

export async function getValidOutlookAccessToken(
  userId: string
): Promise<string> {
  const credentials = getMicrosoftOAuthCredentials();
  if (!credentials) {
    throw new EmailSendingError(
      "OUTLOOK_NOT_CONFIGURED",
      "Microsoft OAuth credentials are not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.",
      { statusCode: 500, retryable: false }
    );
  }

  const connection = await getOutlookConnection(userId);
  if (!connection?.refresh_token) {
    throw new EmailSendingError(
      "OUTLOOK_NOT_CONNECTED",
      "Outlook is not connected. Connect your Microsoft account from Settings.",
      { statusCode: 400, retryable: false }
    );
  }

  if (connection.access_token && isTokenValid(connection.token_expires_at)) {
    return connection.access_token;
  }

  let response: Response;
  try {
    response = await fetch(
      `https://login.microsoftonline.com/${getMicrosoftTenantId()}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          refresh_token: connection.refresh_token,
          grant_type: "refresh_token",
          scope: "offline_access Mail.Send Mail.Read User.Read",
        }),
      }
    );
  } catch (error) {
    throw new EmailSendingError(
      "NETWORK_ERROR",
      "Failed to refresh Outlook access token.",
      { statusCode: 502, retryable: true, cause: error }
    );
  }

  const body = (await response.json()) as TokenResponse;

  if (!response.ok || !body.access_token) {
    throw new EmailSendingError(
      "SEND_FAILED",
      body.error_description ??
        body.error ??
        "Failed to refresh Outlook access token.",
      { statusCode: 502, retryable: false }
    );
  }

  const expiresAt = new Date(
    Date.now() + (body.expires_in ?? 3600) * 1000
  ).toISOString();

  await updateOutlookAccessToken(userId, body.access_token, expiresAt);

  return body.access_token;
}
