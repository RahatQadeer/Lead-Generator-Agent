/** Block non-commercial entities from B2B company discovery. */

const NON_COMMERCIAL_TLD =
  /\.(edu|mil|ac\.uk|museum|int)(\.|$)|\.gov(\.|$)|\.govt\./i;

const GOVERNMENT_SIGNALS =
  /\b(government agency|federal agency|municipal|public sector|ministry of|department of|city of|county of|state of|parliament|legislature|embassy)\b/i;

const MILITARY_SIGNALS =
  /\b(military|armed forces|defence force|defense department|ministry of defence|ministry of defense|nato\b|pentagon|veterans affairs)\b/i;

const UNIVERSITY_SIGNALS =
  /\b(university|college|polytechnic|institute of technology|school of|faculty of|academic institution|higher education|campus)\b/i;

const MUSEUM_SIGNALS =
  /\b(museum|art gallery|cultural center|heritage site|exhibition hall|memorial foundation)\b/i;

const NONPROFIT_SIGNALS =
  /\b(nonprofit|non-profit|not-for-profit|ngo\b|charity|charitable foundation|501\(c\)|501c3|philanthrop)\b/i;

const INFORMATION_PORTAL_SIGNALS =
  /\b(wikipedia|encyclopedia|dictionary|reference guide|how to guide|what is|definition of)\b/i;

/** VCs, accelerators, incubators — not operating companies. */
const INVESTOR_ACCELERATOR_SIGNALS =
  /\b(venture capital|venture capitalist|vc firm|vc fund|startup accelerator|accelerator program|business incubator|startup incubator|incubator program|seed fund|early[- ]stage fund|hands[- ]on venture capital|angel fund|investment program for startups)\b/i;

const OPERATING_COMPANY_SIGNALS =
  /\b(we build|our product|our platform|software company|saas platform|our solution|customers use|subscription|api platform|we develop|we sell)\b/i;

const KNOWN_ACCELERATOR_DOMAINS = new Set([
  "ycombinator.com",
  "ycombinator.org",
  "techstars.com",
  "500.co",
  "plugandplaytechcenter.com",
  "seedcamp.com",
]);

const KNOWN_INVESTMENT_DOMAINS = new Set([
  "verdane.com",
  "eqtgroup.com",
  "kinnevik.com",
  "norrsken.org",
  "sequoiacap.com",
  "a16z.com",
  "accel.com",
  "balderton.com",
  "creandum.com",
]);

export interface OrgTypeCheckResult {
  blocked: boolean;
  reason: string | null;
}

function combinedText(
  name: string,
  description?: string | null,
  domain?: string | null
): string {
  return [name, description, domain].filter(Boolean).join(" ").toLowerCase();
}

export function isNonCommercialDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return NON_COMMERCIAL_TLD.test(domain.toLowerCase().replace(/^www\./, ""));
}

/** Reject government, military, museums, universities, nonprofits, and generic info sites. */
export function isNonCommercialOrganization(input: {
  name: string;
  description?: string | null;
  domain?: string | null;
}): OrgTypeCheckResult {
  const domain = input.domain?.toLowerCase().replace(/^www\./, "") ?? "";
  const text = combinedText(input.name, input.description, domain);

  if (domain && isNonCommercialDomain(domain)) {
    return { blocked: true, reason: "non_commercial_domain" };
  }

  if (GOVERNMENT_SIGNALS.test(text)) {
    return { blocked: true, reason: "government" };
  }

  if (MILITARY_SIGNALS.test(text)) {
    return { blocked: true, reason: "military" };
  }

  if (UNIVERSITY_SIGNALS.test(text)) {
    return { blocked: true, reason: "university" };
  }

  if (MUSEUM_SIGNALS.test(text)) {
    return { blocked: true, reason: "museum" };
  }

  if (NONPROFIT_SIGNALS.test(text)) {
    return { blocked: true, reason: "nonprofit" };
  }

  if (INFORMATION_PORTAL_SIGNALS.test(text) && !/\b(software|saas|technology)\b/i.test(text)) {
    return { blocked: true, reason: "information_portal" };
  }

  return { blocked: false, reason: null };
}

/** Reject VCs, accelerators, and incubators unless the profile is clearly an operating company. */
export function isInvestorOrAcceleratorOrganization(input: {
  name: string;
  description?: string | null;
  domain?: string | null;
}): OrgTypeCheckResult {
  const domain = input.domain?.toLowerCase().replace(/^www\./, "") ?? "";
  const text = combinedText(input.name, input.description, domain);

  if (KNOWN_ACCELERATOR_DOMAINS.has(domain) || KNOWN_INVESTMENT_DOMAINS.has(domain)) {
    if (!OPERATING_COMPANY_SIGNALS.test(text)) {
      return {
        blocked: true,
        reason: KNOWN_ACCELERATOR_DOMAINS.has(domain) ? "investor_accelerator" : "investor_accelerator",
      };
    }
  }

  if (/\by combinator\b/i.test(input.name) || /\bverdane\b/i.test(text)) {
    if (!OPERATING_COMPANY_SIGNALS.test(text)) {
      return { blocked: true, reason: "investor_accelerator" };
    }
  }

  if (!INVESTOR_ACCELERATOR_SIGNALS.test(text)) {
    return { blocked: false, reason: null };
  }

  if (OPERATING_COMPANY_SIGNALS.test(text)) {
    return { blocked: false, reason: null };
  }

  return { blocked: true, reason: "investor_accelerator" };
}

export function isNonCommercialTitle(title: string): boolean {
  const text = title.trim();
  if (!text) return true;

  return (
    UNIVERSITY_SIGNALS.test(text) ||
    GOVERNMENT_SIGNALS.test(text) ||
    MUSEUM_SIGNALS.test(text) ||
    MILITARY_SIGNALS.test(text) ||
    NONPROFIT_SIGNALS.test(text) ||
    /^list of\b/i.test(text)
  );
}
