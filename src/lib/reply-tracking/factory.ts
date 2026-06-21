import type { ReplyDetector } from "@/lib/reply-tracking/types";
import { GmailReplyDetector } from "@/lib/reply-tracking/gmail-detector";
import { MockReplyDetector } from "@/lib/reply-tracking/mock-detector";
import { OutlookReplyDetector } from "@/lib/reply-tracking/outlook-detector";
import { getConfiguredSendingProviderName } from "@/lib/email-sending/factory";

export type ReplyTrackingProviderName = "mock" | "gmail" | "outlook";

export function getConfiguredReplyTrackingProvider(): ReplyTrackingProviderName {
  const provider =
    process.env.REPLY_TRACKING_PROVIDER?.toLowerCase() ??
    getConfiguredSendingProviderName();

  if (provider === "gmail" || provider === "outlook") {
    return provider;
  }

  return "mock";
}

export function createReplyDetector(): ReplyDetector {
  const provider = getConfiguredReplyTrackingProvider();

  if (provider === "gmail") {
    return new GmailReplyDetector();
  }

  if (provider === "outlook") {
    return new OutlookReplyDetector();
  }

  return new MockReplyDetector();
}
