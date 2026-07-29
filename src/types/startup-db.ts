import type { Json } from "@/types/database";

/**
 * Row shape of public.startup_companies (migrations 033 + 034).
 *
 * Declared as a type alias rather than an interface deliberately: supabase-js
 * constrains table types to `Record<string, unknown>`, and TypeScript grants an
 * implicit index signature to type aliases but NOT to interfaces. Declared as an
 * interface, this table silently resolves to `never` on every query.
 */
export type StartupCompanyRow = {
  id: string;
  dedup_key: string;
  source: string;
  source_url: string | null;
  source_company_id: string | null;
  name: string;
  domain: string | null;
  website_url: string | null;
  description: string | null;
  industry: string | null;
  category: string | null;
  tags: string[];
  country: string | null;
  city: string | null;
  state: string | null;
  funding_stage: string | null;
  investors: string[];
  team_size: number | null;
  launch_date: string | null;
  public_email: string | null;
  public_phone: string | null;
  contact_page_url: string | null;
  careers_page_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  github_url: string | null;
  facebook_url: string | null;

  // --- migration 034: directory scraper fields ---
  /** Cohort label as published, e.g. "Winter 2024". */
  batch: string | null;
  /** active | acquired | ipo | exited | inactive, as the source reports it. */
  portfolio_status: string | null;
  founded_year: number | null;
  /** As published ("$12M") — sources rarely agree on units or currency. */
  total_funding: string | null;
  logo_url: string | null;
  crunchbase_url: string | null;
  product_hunt_url: string | null;
  /** All published role inboxes; `public_email` holds the primary one. */
  public_emails: string[];
  public_phones: string[];

  website_extras: Json;
  raw_profile: Json | null;
  first_seen_at: string;
  last_seen_at: string;
  scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

export type StartupCompanyInsert = Omit<
  StartupCompanyRow,
  "id" | "first_seen_at" | "created_at"
> & {
  id?: string;
  first_seen_at?: string;
  created_at?: string;
};

/** Row shape of public.startup_people. Type alias for the reason above. */
export type StartupPersonRow = {
  id: string;
  startup_id: string;
  dedup_key: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  role_type: string | null;
  linkedin_url: string | null;
  email: string | null;
  source: string | null;

  // --- migration 034 ---
  twitter_url: string | null;
  bio: string | null;
  avatar_url: string | null;
  source_url: string | null;

  created_at: string;
  updated_at: string;
}

export type StartupPersonInsert = Omit<StartupPersonRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

/**
 * Minimal Supabase Database shape covering only the startup catalog tables, so a
 * typed client can query them without regenerating the full database.ts.
 */
export interface StartupDatabase {
  public: {
    Tables: {
      startup_companies: {
        Row: StartupCompanyRow;
        Insert: StartupCompanyInsert;
        Update: Partial<StartupCompanyInsert>;
        Relationships: [];
      };
      startup_people: {
        Row: StartupPersonRow;
        Insert: StartupPersonInsert;
        Update: Partial<StartupPersonInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
