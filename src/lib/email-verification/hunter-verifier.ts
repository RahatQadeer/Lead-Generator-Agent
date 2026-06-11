import { EmailVerificationError } from "@/lib/email-verification/errors";
import type {
  ApiVerificationResult,
  EmailVerificationApiProvider,
} from "@/lib/email-verification/types";

const HUNTER_BASE_URL = "https://api.hunter.io/v2/email-verifier";

interface HunterVerifierResponse {
  data?: {
    status?: string;
    result?: string;
    score?: number;
  };
  errors?: Array<{ id?: string; details?: string }>;
}

function mapHunterStatus(status: string | undefined): ApiVerificationResult {
  switch (status) {
    case "valid":
      return { status: "valid", message: "Email is deliverable." };
    case "invalid":
      return { status: "invalid", message: "Email is not deliverable." };
    case "accept_all":
    case "webmail":
    case "disposable":
      return {
        status: "risky",
        message: `Email flagged as ${status.replace("_", " ")}.`,
      };
    case "unknown":
    default:
      return { status: "unknown", message: "Verification inconclusive." };
  }
}

export class HunterEmailVerificationProvider implements EmailVerificationApiProvider {
  readonly name = "hunter";

  constructor(private readonly apiKey: string) {}

  async verify(email: string): Promise<ApiVerificationResult> {
    const url = new URL(HUNTER_BASE_URL);
    url.searchParams.set("email", email);
    url.searchParams.set("api_key", this.apiKey);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    } catch (error) {
      throw new EmailVerificationError(
        "NETWORK_ERROR",
        "Failed to reach Hunter email verifier.",
        { retryable: true, cause: error }
      );
    }

    let body: HunterVerifierResponse = {};
    try {
      body = (await response.json()) as HunterVerifierResponse;
    } catch {
      throw new EmailVerificationError(
        "PROVIDER_ERROR",
        "Hunter returned an invalid response.",
        { statusCode: response.status, retryable: false }
      );
    }

    if (!response.ok) {
      const message =
        body.errors?.[0]?.details ??
        `Hunter API returned status ${response.status}`;

      if (response.status === 401) {
        throw new EmailVerificationError("AUTH_ERROR", message, {
          statusCode: 401,
          retryable: false,
        });
      }

      if (response.status === 429) {
        throw new EmailVerificationError("RATE_LIMIT", message, {
          statusCode: 429,
          retryable: true,
        });
      }

      throw new EmailVerificationError("PROVIDER_ERROR", message, {
        statusCode: response.status,
        retryable: response.status >= 500,
      });
    }

    return mapHunterStatus(body.data?.status);
  }
}
