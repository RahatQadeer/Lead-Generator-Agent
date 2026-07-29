/**
 * The search builder's form contract.
 *
 * One Zod schema is the single source of truth for the form's shape, its
 * validation, and the payload sent to `/api/pipeline/run`. The API validates
 * again server-side (`parse-run-request.ts`) — this is for the user's benefit,
 * not the server's, so it can afford to be friendlier and more specific.
 *
 * Field names match migration 035 exactly so a saved row round-trips into the
 * form without a translation layer.
 */
import { z } from "zod";
import { DECISION_MAKER_LADDER } from "@/lib/contact-discovery/decision-maker-ladder";

export const COMPANY_TYPES = ["startup", "scale-up", "enterprise"] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

export const FUNDING_STAGES = [
  "bootstrapped",
  "pre_seed",
  "seed",
  "series_a",
  "series_b",
  "series_c",
  "series_d_plus",
  "public",
  "acquired",
] as const;

export const CONTACT_TYPES = [
  "linkedin",
  "work_email",
  "phone",
  "website",
  "contact_page",
  "twitter",
  "github",
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

/** Ladder keys are the stored value; labels are display only. */
export const ROLE_KEYS = DECISION_MAKER_LADDER.map((rung) => rung.key);

export const RECENTLY_FUNDED_OPTIONS = [
  { value: 1, label: "Last 30 days" },
  { value: 3, label: "Last 90 days" },
  { value: 6, label: "Last 6 months" },
  { value: 12, label: "Last year" },
] as const;

export const COMPANY_SIZE_BANDS = [
  { label: "1–10", min: 1, max: 10 },
  { label: "11–50", min: 11, max: 50 },
  { label: "51–200", min: 51, max: 200 },
  { label: "201–500", min: 201, max: 500 },
  { label: "501–1000", min: 501, max: 1000 },
  { label: "1000+", min: 1000, max: null },
] as const;

/**
 * No field uses `.default()`.
 *
 * A Zod default makes the field optional on the schema's INPUT type while it
 * stays required on the OUTPUT type. `useForm<SearchBuilderValues>` is typed on
 * the output, so a defaulted schema produces a `zodResolver` whose input type
 * does not match — and the mismatch cascades into every `Control<...>` prop in
 * the six sections.
 *
 * The defaults are redundant anyway: `emptySearchBuilderValues` below is a
 * complete value object and is what `useForm({ defaultValues })` receives.
 */
export const searchBuilderSchema = z
  .object({
    // --- details ---
    name: z
      .string()
      .trim()
      .min(1, "Give this search a name so you can find it later.")
      .max(120, "Keep the name under 120 characters."),

    // --- company filters ---
    countries: z.array(z.string().trim().min(1)),
    industries: z.array(z.string().trim().min(1)),
    companySizeMin: z.number().int().min(0).nullable(),
    companySizeMax: z.number().int().min(0).nullable(),
    companyType: z.enum(COMPANY_TYPES).nullable(),
    fundingStages: z.array(z.enum(FUNDING_STAGES)),
    recentlyFundedMonths: z.number().int().positive().max(120).nullable(),
    keywords: z.array(z.string().trim().min(1)),

    // --- people ---
    roleKeys: z.array(z.string()),

    // --- contact ---
    contactTypes: z.array(z.enum(CONTACT_TYPES)),

    // --- providers ---
    // Empty means "every enabled provider", matching the column default.
    enabledProviders: z.array(z.string()),

    // --- run options ---
    limit: z.number().int().min(0).max(500),
    enrichCompanies: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (
      value.companySizeMin !== null &&
      value.companySizeMax !== null &&
      value.companySizeMin > value.companySizeMax
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["companySizeMax"],
        message: "Maximum size must be greater than the minimum.",
      });
    }

    // A search with no company-side filter at all matches the entire directory,
    // which is almost never intended and costs a very long run. Require at least
    // one narrowing signal rather than silently scraping everything.
    const hasCompanyFilter =
      value.countries.length > 0 ||
      value.industries.length > 0 ||
      value.keywords.length > 0 ||
      value.companyType !== null ||
      value.fundingStages.length > 0 ||
      value.companySizeMin !== null ||
      value.companySizeMax !== null;

    if (!hasCompanyFilter) {
      ctx.addIssue({
        code: "custom",
        path: ["industries"],
        message:
          "Add at least one company filter — country, industry, keyword, size, type or funding stage.",
      });
    }

    const unknownRoles = value.roleKeys.filter((key) => !ROLE_KEYS.includes(key));
    if (unknownRoles.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["roleKeys"],
        message: `Unknown role: ${unknownRoles.join(", ")}`,
      });
    }
  });

export type SearchBuilderValues = z.infer<typeof searchBuilderSchema>;

export const emptySearchBuilderValues: SearchBuilderValues = {
  name: "",
  countries: [],
  industries: [],
  companySizeMin: null,
  companySizeMax: null,
  companyType: null,
  fundingStages: [],
  recentlyFundedMonths: null,
  keywords: [],
  roleKeys: ["founder", "ceo"],
  contactTypes: ["linkedin", "work_email"],
  enabledProviders: [],
  limit: 50,
  enrichCompanies: true,
};

/** Ready-made starting points. Presets set filters only — never the name. */
export interface SearchPreset {
  id: string;
  label: string;
  description: string;
  values: Partial<SearchBuilderValues>;
}

export const SEARCH_PRESETS: SearchPreset[] = [
  {
    id: "us-ai-startups",
    label: "US AI startups",
    description: "Early-stage AI companies in the United States, founders and CEOs.",
    values: {
      countries: ["United States"],
      industries: ["Artificial Intelligence"],
      companySizeMin: 1,
      companySizeMax: 50,
      companyType: "startup",
      fundingStages: ["pre_seed", "seed", "series_a"],
      roleKeys: ["founder", "ceo"],
    },
  },
  {
    id: "recently-funded-fintech",
    label: "Recently funded fintech",
    description: "Fintech companies funded in the last 6 months.",
    values: {
      industries: ["FinTech"],
      fundingStages: ["seed", "series_a", "series_b"],
      recentlyFundedMonths: 6,
      roleKeys: ["ceo", "founder", "cto"],
    },
  },
  {
    id: "eu-saas-scaleups",
    label: "EU SaaS scale-ups",
    description: "Mid-size SaaS companies across Europe, technical decision makers.",
    values: {
      countries: ["Germany", "France", "Netherlands", "Spain"],
      industries: ["SaaS"],
      companySizeMin: 51,
      companySizeMax: 500,
      companyType: "scale-up",
      roleKeys: ["cto", "vp_engineering", "head_of_engineering"],
    },
  },
];

/** Form values → the `/api/pipeline/run` payload. */
export function toPipelineRunPayload(
  values: SearchBuilderValues,
  searchId: string | null
) {
  return {
    searchId,
    industry: values.industries[0] ?? null,
    countries: values.countries,
    keywords: values.keywords,
    companySizeMin: values.companySizeMin,
    companySizeMax: values.companySizeMax,
    fundingStages: values.fundingStages,
    fundedWithinMonths: values.recentlyFundedMonths,
    roleKeys: values.roleKeys,
    providerIds: values.enabledProviders,
    enrichCompanies: values.enrichCompanies,
    limit: values.limit,
  };
}

/** Form values → the `searches` row shape from migration 035. */
export function toSearchRow(values: SearchBuilderValues) {
  return {
    name: values.name,
    // Legacy single-value columns are kept in sync so anything still reading
    // them sees a sensible value rather than null.
    industry: values.industries[0] ?? null,
    country: values.countries[0] ?? null,
    industries: values.industries,
    countries: values.countries,
    company_size_min: values.companySizeMin,
    company_size_max: values.companySizeMax,
    company_type: values.companyType,
    funding_stages: values.fundingStages,
    recently_funded_months: values.recentlyFundedMonths,
    keywords: values.keywords,
    role_keys: values.roleKeys,
    contact_types: values.contactTypes,
    enabled_providers: values.enabledProviders,
  };
}

/** A `searches` row → form values, tolerating rows written before 035. */
export function fromSearchRow(row: Record<string, unknown>): SearchBuilderValues {
  const arr = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  const num = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  // Fall back to the legacy single-value columns when the array columns are
  // empty, so a search created before migration 035 still opens correctly.
  const countries = arr(row.countries);
  const industries = arr(row.industries);

  return {
    name: typeof row.name === "string" ? row.name : "",
    countries:
      countries.length > 0
        ? countries
        : typeof row.country === "string" && row.country
          ? [row.country]
          : [],
    industries:
      industries.length > 0
        ? industries
        : typeof row.industry === "string" && row.industry
          ? [row.industry]
          : [],
    companySizeMin: num(row.company_size_min),
    companySizeMax: num(row.company_size_max),
    companyType: COMPANY_TYPES.includes(row.company_type as CompanyType)
      ? (row.company_type as CompanyType)
      : null,
    fundingStages: arr(row.funding_stages).filter((s) =>
      (FUNDING_STAGES as readonly string[]).includes(s)
    ) as SearchBuilderValues["fundingStages"],
    recentlyFundedMonths: num(row.recently_funded_months),
    keywords: arr(row.keywords),
    roleKeys: arr(row.role_keys),
    contactTypes: arr(row.contact_types).filter((t) =>
      (CONTACT_TYPES as readonly string[]).includes(t)
    ) as ContactType[],
    enabledProviders: arr(row.enabled_providers),
    limit: 50,
    enrichCompanies: true,
  };
}
