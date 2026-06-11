import { getValidOutlookAccessToken } from "@/lib/outlook/token";
import type { OutlookTestResult } from "@/types/outlook-settings";

interface GraphMeResponse {
  mail?: string;
  userPrincipalName?: string;
  error?: {
    message?: string;
  };
}

export async function testOutlookConnection(
  userId: string
): Promise<OutlookTestResult> {
  try {
    const accessToken = await getValidOutlookAccessToken(userId);

    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = (await response.json()) as GraphMeResponse;

    if (!response.ok) {
      return {
        success: false,
        message:
          body.error?.message ??
          `Microsoft Graph returned status ${response.status}.`,
      };
    }

    const emailAddress = body.mail ?? body.userPrincipalName;

    return {
      success: true,
      message: `Outlook connected as ${emailAddress ?? "unknown"}.`,
      emailAddress,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to test Outlook connection.";
    return { success: false, message };
  }
}
