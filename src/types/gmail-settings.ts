export type GmailSendingProviderPreference = "mock" | "gmail";

export interface GmailSettings {
  sendingProvider: GmailSendingProviderPreference;
  updatedAt: string;
}

export interface GmailSettingsStatus {
  sendingProvider: GmailSendingProviderPreference;
  effectiveProvider: GmailSendingProviderPreference;
  connected: boolean;
  accountAddress: string | null;
  connectedAt: string | null;
  oauthConfigured: boolean;
  hasUserSettings: boolean;
  envProvider: string;
}

export interface GmailTestResult {
  success: boolean;
  message: string;
  emailAddress?: string;
}
