import { getConfiguredReplyTrackingProvider } from "@/lib/reply-tracking/factory";
import { resolveSendingProvider } from "@/lib/email-sending/resolve-provider";
import type { ReplyTrackingProviderName } from "@/lib/reply-tracking/factory";

export async function resolveReplyTrackingProvider(
  userId: string
): Promise<ReplyTrackingProviderName> {
  const envProvider = process.env.REPLY_TRACKING_PROVIDER?.toLowerCase();

  if (envProvider === "gmail" || envProvider === "outlook") {
    return envProvider;
  }

  const sendingProvider = await resolveSendingProvider(userId);
  if (sendingProvider === "gmail" || sendingProvider === "outlook") {
    return sendingProvider;
  }

  return getConfiguredReplyTrackingProvider();
}
