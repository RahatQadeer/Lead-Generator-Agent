export type AffiliationSource =
  | "website_team"
  | "linkedin_search"
  | "wikidata"
  | "directory_listing"
  | "domain_search";

export interface CompanyAffiliationTarget {
  name: string;
  domain?: string | null;
}

export interface AffiliationVerifyInput {
  title?: string | null;
  bioText?: string | null;
  source: AffiliationSource;
  /** Person was scraped from the target company's own website (team/about page). */
  onCompanyWebsite?: boolean;
  /** URL or path suggests a leadership/team directory page. */
  leadershipPage?: boolean;
}

const FORMER_EMPLOYMENT_PATTERN =
  /\b(?:former(?:ly)?|ex[-\s]|previous(?:ly)?|past)\b[^|]{0,48}\b(?:at|@|with)\b/i;

const CURRENT_ROLE_PATTERN =
  /\b(?:ceo|cto|cfo|coo|cmo|cpo|chro|founder|co[-\s]?founder|president|director|owner|manager|vp|vice president|editor in chief|editor-in-chief|chief\s+[\w\s]{0,24}\s+officer|head of|vd|grundare|verkställande|styrelse|managing director|general manager|board of directors)\b/i;

const GENERIC_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "usa",
  "uk",
  "inc",
  "llc",
  "ltd",
  "corp",
  "company",
  "group",
]);

function stripLegalSuffix(name: string): string {
  return name
    .replace(
      /\b(incorporated|inc\.?|llc|l\.l\.c\.?|ltd\.?|limited|corp\.?|corporation|company|co\.?|group|holdings|plc)\b/gi,
      ""
    )
    .replace(/[,.']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompanyName(name: string): string {
  return stripLegalSuffix(name.trim()).toLowerCase();
}

/** True when two company names refer to the same organization. */
export function companyNamesMatch(a: string, b: string): boolean {
  const left = normalizeCompanyName(a);
  const right = normalizeCompanyName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 4 && right.length >= 4 && (left.includes(right) || right.includes(left))) {
    return true;
  }
  return false;
}

function companyTokens(name: string): string[] {
  return stripLegalSuffix(name)
    .toLowerCase()
    .split(/[\s,.-]+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 3 && !GENERIC_STOPWORDS.has(token));
}

/** Whether free text references the target company from Step 1. */
export function textMentionsTargetCompany(
  text: string,
  target: CompanyAffiliationTarget
): boolean {
  const value = text.trim();
  if (!value) return false;

  const lower = value.toLowerCase();
  const normalizedName = normalizeCompanyName(target.name);

  if (normalizedName.length >= 2 && lower.includes(normalizedName)) return true;
  if (companyNamesMatch(value, target.name)) return true;

  const tokens = companyTokens(target.name);
  const compact = lower.replace(/[^a-z0-9]/g, "");

  const significant = tokens.filter((token) => token.length >= 4);
  if (significant.length > 0 && significant.every((token) => compact.includes(token))) {
    return true;
  }

  if (tokens.length === 1 && tokens[0].length >= 3 && compact.includes(tokens[0])) {
    return true;
  }

  const domain = target.domain?.replace(/^www\./, "").toLowerCase();
  if (domain) {
    if (lower.includes(domain)) return true;
    const root = domain.split(".")[0];
    if (root && root.length >= 3 && compact.includes(root)) return true;
  }

  return false;
}

export function textIndicatesFormerRoleAtTarget(
  text: string,
  target: CompanyAffiliationTarget
): boolean {
  if (!FORMER_EMPLOYMENT_PATTERN.test(text)) return false;
  return textMentionsTargetCompany(text, target);
}

function extractEmployersAfterAt(text: string): string[] {
  const employers: string[] = [];

  for (const match of text.matchAll(/\b(?:at|@)\s+([^|,.;\n]+)/gi)) {
    const chunk = match[1]?.trim();
    if (!chunk) continue;
    employers.push(chunk.split(/\s*[-–|]\s*/)[0].trim());
  }

  return employers;
}

/** LinkedIn titles use `-`, `|`, `·`, and commas between name, role, and employer. */
function splitLinkedInTitleSegments(title: string): string[] {
  const withoutSuffix = title.replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
  return withoutSuffix
    .split(/\s*[-–|·]\s*/)
    .flatMap((segment) => segment.split(/\s*,\s*/))
    .map((part) => part.trim())
    .filter(Boolean);
}

function linkedInTitleIncludesCompany(
  title: string,
  target: CompanyAffiliationTarget
): boolean {
  const parts = splitLinkedInTitleSegments(title);
  return parts.slice(1).some((part) => textMentionsTargetCompany(part, target));
}

function indicatesCurrentRoleAtTarget(
  text: string,
  target: CompanyAffiliationTarget
): boolean {
  if (!CURRENT_ROLE_PATTERN.test(text)) return false;
  if (!textMentionsTargetCompany(text, target)) return false;

  for (const employer of extractEmployersAfterAt(text)) {
    if (textMentionsTargetCompany(employer, target)) return true;
  }

  return linkedInTitleIncludesCompany(text, target);
}

function indicatesEmploymentAtOtherCompany(
  text: string,
  target: CompanyAffiliationTarget
): boolean {
  for (const employer of extractEmployersAfterAt(text)) {
    if (employer.length < 3) continue;
    if (!textMentionsTargetCompany(employer, target)) return true;
  }

  for (const segment of splitLinkedInTitleSegments(text).slice(1)) {
    if (segment.length < 4) continue;
    if (textMentionsTargetCompany(segment, target)) continue;
    // Bare role-only tokens (e.g. "CEO") — employer is usually in the next segment.
    if (
      segment.length <= 28 &&
      CURRENT_ROLE_PATTERN.test(segment) &&
      !/\b(at|@)\b/i.test(segment)
    ) {
      continue;
    }
    if (/[a-z]/i.test(segment)) {
      return true;
    }
  }

  return false;
}

function titleNamesExternalEmployer(
  title: string,
  target: CompanyAffiliationTarget
): boolean {
  const parts = splitLinkedInTitleSegments(title);
  if (parts.length <= 1) return false;

  return parts.slice(1).some((part) => {
    if (part.length < 4) return false;
    if (textMentionsTargetCompany(part, target)) return false;
    return /[a-z]/i.test(part);
  });
}

/** True when LinkedIn headline/snippet clearly names a different current employer. */
export function linkedInTextNamesOtherEmployer(
  text: string,
  target: CompanyAffiliationTarget
): boolean {
  const value = text.trim();
  if (!value) return false;
  if (titleNamesExternalEmployer(value, target)) return true;
  return indicatesEmploymentAtOtherCompany(value, target);
}

function verifyWebsiteTeamAffiliation(
  input: AffiliationVerifyInput,
  target: CompanyAffiliationTarget
): { matches: boolean; reason: string | null } {
  const combined = [input.title, input.bioText].filter(Boolean).join(" ");
  const title = input.title?.trim() ?? "";

  if (textIndicatesFormerRoleAtTarget(combined, target)) {
    return { matches: false, reason: "former_employee" };
  }

  if (title && titleNamesExternalEmployer(title, target)) {
    return { matches: false, reason: "employed_at_other_company" };
  }

  // Listed on the company's own team/leadership page — trust unless contradicted.
  if (input.onCompanyWebsite && input.leadershipPage) {
    return { matches: true, reason: null };
  }

  if (input.onCompanyWebsite && title && CURRENT_ROLE_PATTERN.test(title)) {
    if (!textIndicatesFormerRoleAtTarget(combined, target)) {
      if (!indicatesEmploymentAtOtherCompany(combined, target)) {
        return { matches: true, reason: null };
      }
    }
  }

  if (textMentionsTargetCompany(combined, target)) {
    if (indicatesCurrentRoleAtTarget(combined, target)) {
      return { matches: true, reason: null };
    }
    if (title && CURRENT_ROLE_PATTERN.test(title)) {
      return { matches: true, reason: null };
    }
    return { matches: false, reason: "no_current_employment" };
  }

  if (input.bioText && !textMentionsTargetCompany(input.bioText, target)) {
    const titleMentionsOther =
      /\bat\s+[^|,.-]+/i.test(input.title ?? "") &&
      !textMentionsTargetCompany(input.title ?? "", target);
    if (titleMentionsOther) {
      return { matches: false, reason: "title_other_company" };
    }
  }

  return { matches: false, reason: "no_company_affiliation_on_page" };
}

function verifyLinkedInSearchAffiliation(
  input: AffiliationVerifyInput,
  target: CompanyAffiliationTarget
): { matches: boolean; reason: string | null } {
  const title = input.title ?? "";
  const bio = input.bioText ?? "";
  const combined = `${title} ${bio}`.trim();

  if (!combined) {
    return { matches: false, reason: "no_affiliation_text" };
  }

  if (title && titleNamesExternalEmployer(title, target)) {
    return { matches: false, reason: "employed_at_other_company" };
  }

  if (!textMentionsTargetCompany(combined, target)) {
    return { matches: false, reason: "company_not_mentioned" };
  }

  if (textIndicatesFormerRoleAtTarget(combined, target)) {
    return { matches: false, reason: "former_employee" };
  }

  if (indicatesEmploymentAtOtherCompany(combined, target)) {
    return { matches: false, reason: "employed_at_other_company" };
  }

  if (linkedInTitleIncludesCompany(title, target)) {
    return { matches: true, reason: null };
  }

  if (indicatesCurrentRoleAtTarget(combined, target)) {
    return { matches: true, reason: null };
  }

  if (/\bcurrent(?:ly)?\b/i.test(combined) && textMentionsTargetCompany(combined, target)) {
    return { matches: true, reason: null };
  }

  return { matches: false, reason: "no_current_employment" };
}

function verifyDirectoryListingAffiliation(
  input: AffiliationVerifyInput,
  target: CompanyAffiliationTarget
): { matches: boolean; reason: string | null } {
  const combined = [input.title, input.bioText].filter(Boolean).join(" ").trim();

  if (!textMentionsTargetCompany(combined, target)) {
    return { matches: false, reason: "listing_not_for_company" };
  }

  if (textIndicatesFormerRoleAtTarget(combined, target)) {
    return { matches: false, reason: "former_employee" };
  }

  const title = input.title?.trim() ?? "";
  if (title && CURRENT_ROLE_PATTERN.test(title)) {
    return { matches: true, reason: null };
  }

  if (indicatesCurrentRoleAtTarget(combined, target)) {
    return { matches: true, reason: null };
  }

  return { matches: false, reason: "no_executive_on_listing" };
}

/**
 * Verify a person is currently affiliated with the Step 1 company.
 * Rejects former employees and unrelated search profiles.
 */
export function verifyPersonCompanyAffiliation(
  input: AffiliationVerifyInput,
  target: CompanyAffiliationTarget
): { matches: boolean; reason: string | null } {
  if (input.source === "wikidata") {
    const combined = [input.title, input.bioText].filter(Boolean).join(" ").trim();
    if (combined && !textMentionsTargetCompany(combined, target)) {
      return { matches: false, reason: "wikidata_company_mismatch" };
    }
    return { matches: true, reason: null };
  }

  if (input.source === "website_team" || input.source === "domain_search") {
    return verifyWebsiteTeamAffiliation(input, target);
  }

  if (input.source === "linkedin_search") {
    return verifyLinkedInSearchAffiliation(input, target);
  }

  if (input.source === "directory_listing") {
    return verifyDirectoryListingAffiliation(input, target);
  }

  return { matches: false, reason: "unknown_source" };
}
