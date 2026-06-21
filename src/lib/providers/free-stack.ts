/**
 * Free-stack policy: scraping, DNS verification, and optional OpenRouter free models.
 * Paid lead-data APIs (Apollo, Hunter, OpenAI) are blocked unless explicitly enabled.
 */

export function isPaidApisDisabled(): boolean {
  const flag = process.env.DISABLE_PAID_APIS?.toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return true;
}

export function paidApisDisabledMessage(provider: string): string {
  return `${provider} is disabled (DISABLE_PAID_APIS=true). Using the free scraping stack instead.`;
}
