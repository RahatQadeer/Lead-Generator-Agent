export type OutlookSendingProviderPreference = "mock" | "outlook";

export interface OutlookSettings {
  sendingProvider: OutlookSendingProviderPreference;
  updatedAt: string;
}

export interface OutlookSettingsStatus {
  sendingProvider: OutlookSendingProviderPreference;
  effectiveProvider: OutlookSendingProviderPreference;
  connected: boolean;
  accountAddress: string | null;
  connectedAt: string | null;
  oauthConfigured: boolean;
  hasUserSettings: boolean;
  envProvider: string;
}

export interface OutlookTestResult {
  success: boolean;
  message: string;
  emailAddress?: string;
}
