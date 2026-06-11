import { getConfiguredSendingProviderName } from "@/lib/email-sending/factory";
import { getGmailSettings } from "@/lib/gmail/settings";
import { getGmailConnection } from "@/lib/gmail/connection";
import { getOutlookConnection } from "@/lib/outlook/connection";
import type { EmailSendingProviderName } from "@/types/email-sending";

export async function resolveSendingProvider(
  userId: string
): Promise<EmailSendingProviderName> {
  const [gmailSettings, gmailConnection, outlookConnection] = await Promise.all([
    getGmailSettings(userId),
    getGmailConnection(userId),
    getOutlookConnection(userId),
  ]);

  const envProvider = getConfiguredSendingProviderName();
  const preferred = gmailSettings?.sendingProvider ?? envProvider;

  if (preferred === "gmail") {
    return gmailConnection?.refresh_token ? "gmail" : "mock";
  }

  if (preferred === "outlook" || envProvider === "outlook") {
    return outlookConnection?.refresh_token ? "outlook" : "mock";
  }

  return "mock";
}
