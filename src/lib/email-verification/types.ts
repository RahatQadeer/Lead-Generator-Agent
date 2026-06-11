export type ApiVerificationStatus = "valid" | "invalid" | "risky" | "unknown";

export interface ApiVerificationResult {
  status: ApiVerificationStatus;
  message: string | null;
}

export interface EmailVerificationApiProvider {
  readonly name: string;
  verify(email: string): Promise<ApiVerificationResult>;
}
