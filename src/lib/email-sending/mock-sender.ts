import type { SendOutreachInput, SendOutreachResult } from "@/types/email-sending";

export async function sendViaMock(
  _input: SendOutreachInput
): Promise<SendOutreachResult> {
  await new Promise((r) => setTimeout(r, 300));

  return {
    provider: "mock",
    messageId: `mock-${Date.now()}`,
    sentAt: new Date().toISOString(),
  };
}
