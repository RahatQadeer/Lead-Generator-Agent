import { getConfiguredSendingProviderName } from "@/lib/email-sending/factory";
import { getGmailSettings } from "@/lib/gmail/settings";
import { getGmailConnection } from "@/lib/gmail/connection";
import { getOutlookSettings } from "@/lib/outlook/settings";
import { getOutlookConnection } from "@/lib/outlook/connection";
import type { EmailSendingProviderName } from "@/types/email-sending";

export async function resolveSendingProvider(
  userId: string
): Promise<EmailSendingProviderName> {
  const [gmailSettings, outlookSettings, gmailConnection, outlookConnection] =
    await Promise.all([
      getGmailSettings(userId),
      getOutlookSettings(userId),
      getGmailConnection(userId),
      getOutlookConnection(userId),
    ]);

  if (outlookSettings?.sendingProvider === "outlook") {
    return outlookConnection?.refresh_token ? "outlook" : "mock";
  }

  if (gmailSettings?.sendingProvider === "gmail") {
    return gmailConnection?.refresh_token ? "gmail" : "mock";
  }

  const envProvider = getConfiguredSendingProviderName();

  if (envProvider === "gmail") {
    return gmailConnection?.refresh_token ? "gmail" : "mock";
  }

  if (envProvider === "outlook") {
    return outlookConnection?.refresh_token ? "outlook" : "mock";
  }

  return "mock";
}
