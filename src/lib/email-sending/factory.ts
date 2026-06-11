import type { EmailSendingProviderName } from "@/types/email-sending";

export function getConfiguredSendingProviderName(): EmailSendingProviderName {
  const provider =
    process.env.EMAIL_SENDING_PROVIDER?.toLowerCase() ??
    process.env.GMAIL_SENDING_PROVIDER?.toLowerCase();

  if (provider === "gmail" || provider === "outlook") {
    return provider;
  }

  return "mock";
}

export function getSendingProviderLabel(
  provider: EmailSendingProviderName
): string {
  switch (provider) {
    case "gmail":
      return "Gmail";
    case "outlook":
      return "Outlook";
    default:
      return "Mock";
  }
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
