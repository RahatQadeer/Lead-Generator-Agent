import type { EmailSendingProviderName } from "@/types/email-sending";

export function getConfiguredSendingProviderName(): EmailSendingProviderName {
  const provider = process.env.GMAIL_SENDING_PROVIDER?.toLowerCase();

  if (provider === "gmail") {
    return "gmail";
  }

  return "mock";
}

export function getGoogleOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}
