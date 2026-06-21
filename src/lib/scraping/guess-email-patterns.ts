import { validateEmailDomain } from "@/lib/email-verification/validate-domain";
import { validateEmailSyntax } from "@/lib/email-verification/validate-syntax";

function normalizeNamePart(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

/** Common B2B email patterns (first@, first.last@, f.last@). */
export function buildEmailPatternCandidates(
  firstName: string,
  lastName: string | null | undefined,
  domain: string
): string[] {
  const host = domain.replace(/^www\./, "").toLowerCase();
  const first = normalizeNamePart(firstName);
  const last = normalizeNamePart(lastName);

  if (!first || !host) return [];

  const candidates: string[] = [`${first}@${host}`];

  if (last) {
    candidates.push(`${first}.${last}@${host}`);
    candidates.push(`${first[0]}.${last}@${host}`);
    candidates.push(`${first}${last}@${host}`);
  }

  return [...new Set(candidates)];
}

export function isEmailPatternGuessEnabled(): boolean {
  const flag = process.env.EMAIL_PATTERN_GUESS_ENABLED?.toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

/** Pick the first syntactically valid pattern when the company domain has MX records. */
export async function guessEmailFromPatterns(
  firstName: string,
  lastName: string | null | undefined,
  domain: string
): Promise<string | null> {
  const host = domain.replace(/^www\./, "").toLowerCase();
  const candidates = buildEmailPatternCandidates(firstName, lastName, host);
  if (candidates.length === 0) return null;

  const probe = candidates[0]!;
  const domainCheck = await validateEmailDomain(probe);
  if (!domainCheck.valid) return null;

  for (const candidate of candidates) {
    const syntax = validateEmailSyntax(candidate);
    if (syntax.valid) return candidate;
  }

  return null;
}
