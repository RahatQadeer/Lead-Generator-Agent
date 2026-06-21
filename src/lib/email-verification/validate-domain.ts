import { resolve4, resolveMx } from "dns/promises";
import { extractEmailDomain } from "@/lib/email-verification/validate-syntax";

const MOCK_INVALID_DOMAINS = new Set([
  "invalid.test",
  "no-mx.local",
  "bad-domain.invalid",
]);

export async function validateEmailDomain(
  email: string,
  options: { useMockRules?: boolean } = {}
): Promise<{ valid: boolean; message: string | null }> {
  const domain = extractEmailDomain(email);
  if (!domain) {
    return { valid: false, message: "Could not extract domain from email." };
  }

  if (options.useMockRules && MOCK_INVALID_DOMAINS.has(domain)) {
    return {
      valid: false,
      message: `Domain "${domain}" has no mail server (mock rule).`,
    };
  }

  if (options.useMockRules) {
    return { valid: true, message: null };
  }

  try {
    const mxRecords = await resolveMx(domain);
    if (mxRecords.length > 0) {
      return { valid: true, message: null };
    }
  } catch {
    // Fall through to A record check.
  }

  try {
    const aRecords = await resolve4(domain);
    if (aRecords.length > 0) {
      return { valid: true, message: null };
    }
  } catch {
    // Domain not resolvable.
  }

  return {
    valid: false,
    message: `Domain "${domain}" has no MX or A records.`,
  };
}
