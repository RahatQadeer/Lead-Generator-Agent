/**
 * Display labels for the search builder.
 *
 * Separate from the schema so the stored values (ladder keys, snake_case enums)
 * can never be affected by a wording change — renaming a label must not orphan a
 * saved search.
 */
import { DECISION_MAKER_LADDER } from "@/lib/contact-discovery/decision-maker-ladder";
import type { CompanyType, ContactType } from "@/lib/search-builder/schema";
import { FUNDING_STAGES } from "@/lib/search-builder/schema";

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  startup: "Startup",
  "scale-up": "Scale-up",
  enterprise: "Enterprise",
};

export const FUNDING_STAGE_LABELS: Record<(typeof FUNDING_STAGES)[number], string> = {
  bootstrapped: "Bootstrapped",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b: "Series B",
  series_c: "Series C",
  series_d_plus: "Series D+",
  public: "Public",
  acquired: "Acquired",
};

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  linkedin: "LinkedIn",
  work_email: "Work email",
  phone: "Phone",
  website: "Company website",
  contact_page: "Contact page",
  twitter: "Twitter / X",
  github: "GitHub",
};

/** Role options in ladder order — rank 1 (best decision maker) first. */
export const ROLE_OPTIONS = DECISION_MAKER_LADDER.map((rung) => ({
  value: rung.key,
  label: rung.label,
  rank: rung.rank,
}));

export const PROVIDER_KIND_LABELS: Record<string, string> = {
  company: "Company sources",
  people: "People sources",
  contact: "Contact sources",
  funding: "Funding sources",
};
