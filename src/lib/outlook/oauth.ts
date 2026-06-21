const MICROSOFT_AUTH_BASE = "https://login.microsoftonline.com";
const MICROSOFT_GRAPH_SCOPE = "offline_access Mail.Send User.Read";

export function getMicrosoftTenantId(): string {
  return process.env.MICROSOFT_TENANT_ID?.trim() || "common";
}

export function getMicrosoftOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

export function getOutlookRedirectUri(origin: string): string {
  return `${origin}/auth/outlook/callback`;
}

export function buildOutlookAuthorizeUrl(input: {
  origin: string;
  state: string;
}): string {
  const credentials = getMicrosoftOAuthCredentials();
  if (!credentials) {
    throw new Error("Microsoft OAuth credentials are not configured.");
  }

  const params = new URLSearchParams({
    client_id: credentials.clientId,
    response_type: "code",
    redirect_uri: getOutlookRedirectUri(input.origin),
    response_mode: "query",
    scope: MICROSOFT_GRAPH_SCOPE,
    state: input.state,
    prompt: "consent",
  });

  return `${MICROSOFT_AUTH_BASE}/${getMicrosoftTenantId()}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeOutlookAuthCode(input: {
  origin: string;
  code: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const credentials = getMicrosoftOAuthCredentials();
  if (!credentials) {
    throw new Error("Microsoft OAuth credentials are not configured.");
  }

  const response = await fetch(
    `${MICROSOFT_AUTH_BASE}/${getMicrosoftTenantId()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code: input.code,
        redirect_uri: getOutlookRedirectUri(input.origin),
        grant_type: "authorization_code",
        scope: MICROSOFT_GRAPH_SCOPE,
      }),
    }
  );

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token || !body.refresh_token) {
    throw new Error(
      body.error_description ?? body.error ?? "Failed to exchange Outlook auth code."
    );
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in ?? 3600,
  };
}

export async function fetchOutlookProfileEmail(
  accessToken: string
): Promise<string | null> {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;

  const body = (await response.json()) as {
    mail?: string;
    userPrincipalName?: string;
  };

  return body.mail ?? body.userPrincipalName ?? null;
}
