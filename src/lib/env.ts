import { z } from "zod";

const providerEnum = z.enum(["mock", "scraping", "companies-house", "apollo", "apify"]);
const contactProviderEnum = z.enum([
  "mock",
  "scraping",
  "companies-house",
  "apollo",
  "apify",
  "pdl",
  "people-data-labs",
  "peopledatalabs",
]);
const emailVerificationEnum = z.enum(["mock", "dns", "hunter"]);
const emailGenerationEnum = z.enum(["mock", "openai", "openrouter"]);
const emailSendingEnum = z.enum(["mock", "gmail", "outlook"]);
const replyTrackingEnum = z.enum(["mock", "gmail", "outlook"]);

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  COMPANY_DATA_PROVIDER: providerEnum.default("scraping"),
  /** Step 2 people discovery — defaults to PDL when PEOPLE_DATA_LABS_API_KEY is set. */
  CONTACT_DISCOVERY_PROVIDER: contactProviderEnum.optional(),
  PEOPLE_DATA_LABS_API_KEY: z.string().optional(),
  COMPANIES_HOUSE_API_KEY: z.string().optional(),
  SEARXNG_URL: z.string().url().optional(),
  REDIS_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  EMAIL_VERIFICATION_PROVIDER: emailVerificationEnum.default("dns"),
  EMAIL_GENERATION_PROVIDER: emailGenerationEnum.default("mock"),
  EMAIL_SENDING_PROVIDER: emailSendingEnum.default("mock"),
  GMAIL_SENDING_PROVIDER: emailSendingEnum.optional(),
  REPLY_TRACKING_PROVIDER: replyTrackingEnum.optional(),
  APOLLO_API_KEY: z.string().optional(),
  HUNTER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  SCRAPING_PLAYWRIGHT_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .optional(),
  DISABLE_PAID_APIS: z.enum(["true", "false", "1", "0", "yes", "no"]).optional(),
  EMAIL_SMTP_VERIFY_ENABLED: z.enum(["true", "false", "1", "0"]).optional(),
  OPEN_CORPORATES_API_TOKEN: z.string().optional(),
  COMPANY_DIRECTORY_ENABLED: z.enum(["true", "false", "1", "0"]).optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  GOOGLE_MAPS_DIRECTORY_ENABLED: z.enum(["true", "false", "1", "0", "yes", "no"]).optional(),
  APIFY_API_TOKEN: z.string().optional(),
  APIFY_ENABLED: z.enum(["true", "false", "1", "0", "yes", "no"]).optional(),
  APIFY_GOOGLE_MAPS_ACTOR: z.string().optional(),
  APIFY_WEBSITE_CRAWLER_ACTOR: z.string().optional(),
  APIFY_MAX_PLACES_PER_SEARCH: z.string().optional(),
  APIFY_RUN_TIMEOUT_SEC: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function validateServerEnv(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      ),
      warnings: [],
    };
  }

  const warnings: string[] = [];
  const env = parsed.data;
  const paidDisabled =
    env.DISABLE_PAID_APIS?.toLowerCase() !== "false" &&
    env.DISABLE_PAID_APIS !== "0" &&
    env.DISABLE_PAID_APIS !== "no";

  if (paidDisabled && env.COMPANY_DATA_PROVIDER === "apollo") {
    warnings.push(
      "COMPANY_DATA_PROVIDER=apollo is ignored while DISABLE_PAID_APIS is enabled. Using scraping."
    );
  }

  if (paidDisabled && env.EMAIL_VERIFICATION_PROVIDER === "hunter") {
    warnings.push(
      "EMAIL_VERIFICATION_PROVIDER=hunter is ignored while DISABLE_PAID_APIS is enabled. Using DNS."
    );
  }

  if (paidDisabled && env.EMAIL_GENERATION_PROVIDER === "openai") {
    warnings.push(
      "EMAIL_GENERATION_PROVIDER=openai is ignored while DISABLE_PAID_APIS is enabled. Use openrouter or mock."
    );
  }

  if (!paidDisabled && env.COMPANY_DATA_PROVIDER === "apollo" && !env.APOLLO_API_KEY) {
    warnings.push("COMPANY_DATA_PROVIDER=apollo but APOLLO_API_KEY is missing.");
  }

  if (!paidDisabled && env.EMAIL_VERIFICATION_PROVIDER === "hunter" && !env.HUNTER_API_KEY) {
    warnings.push("EMAIL_VERIFICATION_PROVIDER=hunter but HUNTER_API_KEY is missing.");
  }

  if (env.EMAIL_GENERATION_PROVIDER === "openai" && !env.OPENAI_API_KEY && !paidDisabled) {
    warnings.push("EMAIL_GENERATION_PROVIDER=openai but OPENAI_API_KEY is missing.");
  }

  if (env.EMAIL_GENERATION_PROVIDER === "openrouter" && !env.OPENROUTER_API_KEY) {
    warnings.push(
      "EMAIL_GENERATION_PROVIDER=openrouter but OPENROUTER_API_KEY is missing."
    );
  }

  if (paidDisabled && env.COMPANY_DATA_PROVIDER === "apify") {
    warnings.push(
      "COMPANY_DATA_PROVIDER=apify is ignored while DISABLE_PAID_APIS is enabled. Using scraping."
    );
  }

  if (env.COMPANY_DATA_PROVIDER === "apify" && !env.APIFY_API_TOKEN) {
    warnings.push("COMPANY_DATA_PROVIDER=apify but APIFY_API_TOKEN is missing.");
  }

  if (env.CONTACT_DISCOVERY_PROVIDER === "pdl" && !env.PEOPLE_DATA_LABS_API_KEY) {
    warnings.push("CONTACT_DISCOVERY_PROVIDER=pdl but PEOPLE_DATA_LABS_API_KEY is missing.");
  }

  if (env.APIFY_API_TOKEN && env.APIFY_ENABLED === "false") {
    warnings.push("APIFY_API_TOKEN is set but APIFY_ENABLED=false — Apify will not run.");
  }

  if (
    (env.EMAIL_SENDING_PROVIDER === "gmail" || env.GMAIL_SENDING_PROVIDER === "gmail") &&
    (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
  ) {
    warnings.push("Gmail sending selected but Google OAuth credentials are missing.");
  }

  return { valid: true, errors: [], warnings };
}

export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}
