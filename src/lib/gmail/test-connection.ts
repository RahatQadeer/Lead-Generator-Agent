import { getValidGmailAccessToken } from "@/lib/gmail/token";
import type { GmailTestResult } from "@/types/gmail-settings";

interface GmailProfileResponse {
  emailAddress?: string;
  error?: {
    message?: string;
  };
}

export async function testGmailConnection(userId: string): Promise<GmailTestResult> {
  try {
    const accessToken = await getValidGmailAccessToken(userId);

    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const body = (await response.json()) as GmailProfileResponse;

    if (!response.ok) {
      return {
        success: false,
        message:
          body.error?.message ??
          `Gmail API returned status ${response.status}.`,
      };
    }

    return {
      success: true,
      message: `Gmail connected as ${body.emailAddress ?? "unknown"}.`,
      emailAddress: body.emailAddress,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to test Gmail connection.";
    return { success: false, message };
  }
}
