import { validateEmailDomain } from "@/lib/email-verification/validate-domain";
import { validateEmailSyntax } from "@/lib/email-verification/validate-syntax";
import type {
  ApiVerificationResult,
  EmailVerificationApiProvider,
} from "@/lib/email-verification/types";

export class DnsEmailVerificationProvider implements EmailVerificationApiProvider {
  readonly name = "dns";

  async verify(email: string): Promise<ApiVerificationResult> {
    const syntax = validateEmailSyntax(email);
    if (!syntax.valid) {
      return {
        status: "invalid",
        message: syntax.message ?? "Invalid email syntax.",
      };
    }

    const domain = await validateEmailDomain(email, { useMockRules: false });
    if (!domain.valid) {
      return {
        status: "invalid",
        message: domain.message ?? "Domain has no mail server.",
      };
    }

    return {
      status: "valid",
      message: "Domain has valid MX/A records.",
    };
  }
}
