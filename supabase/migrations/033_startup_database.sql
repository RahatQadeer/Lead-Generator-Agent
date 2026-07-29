-- ────────────────────────────────────────────────────────────────────────────
-- Startup database: a global, app-wide catalog of venture-backed startups built
-- by scraping public startup directories (YC, Techstars, 500, Antler, OpenVC,
-- Seedtable, F6S, VC portfolios). The Lead Generator searches THIS catalog
-- instead of performing live web searches.
--
-- Written by the ingestion scrapers via the service role (bypasses RLS).
-- Readable by any authenticated user (shared reference data).
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.startup_companies (
  id uuid primary key default gen_random_uuid(),
  -- Global dedup key (normalized domain, else slugified name). One row per company.
  dedup_key text not null unique,

  -- Provenance
  source text not null,                 -- scraper source id (ycombinator, a16z-portfolio, …)
  source_url text,                      -- directory profile / listing URL
  source_company_id text,

  -- Firmographics
  name text not null,
  domain text,
  website_url text,
  description text,
  industry text,
  category text,
  tags text[] not null default '{}',
  country text,
  city text,
  state text,

  -- Funding (public only)
  funding_stage text,
  investors text[] not null default '{}',
  team_size integer,
  launch_date text,

  -- Public business contact + pages
  public_email text,
  public_phone text,
  contact_page_url text,
  careers_page_url text,

  -- Social links
  linkedin_url text,
  twitter_url text,
  github_url text,
  facebook_url text,

  -- Extras + raw payload for future re-processing
  website_extras jsonb not null default '{}'::jsonb,
  raw_profile jsonb,

  -- Full-text search over name/description/industry/tags for fast local queries
  search_text tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(industry, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(array_to_string(tags, ' '), '')
    )
  ) stored,

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  scraped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists startup_companies_domain_idx on public.startup_companies (domain);
create index if not exists startup_companies_industry_idx on public.startup_companies (lower(industry));
create index if not exists startup_companies_country_idx on public.startup_companies (lower(country));
create index if not exists startup_companies_source_idx on public.startup_companies (source);
create index if not exists startup_companies_team_size_idx on public.startup_companies (team_size);
create index if not exists startup_companies_tags_idx on public.startup_companies using gin (tags);
create index if not exists startup_companies_investors_idx on public.startup_companies using gin (investors);
create index if not exists startup_companies_search_idx on public.startup_companies using gin (search_text);

-- Founders / leadership discovered on each company's page.
create table if not exists public.startup_people (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startup_companies (id) on delete cascade,
  dedup_key text not null,              -- normalized name (per startup)
  full_name text not null,
  first_name text,
  last_name text,
  title text,
  role_type text,                       -- founder | ceo | cto | cmo | coo | cfo | exec
  linkedin_url text,
  email text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (startup_id, dedup_key)
);

create index if not exists startup_people_startup_id_idx on public.startup_people (startup_id);

-- RLS: read-only for authenticated users; writes happen via the service role.
alter table public.startup_companies enable row level security;
alter table public.startup_people enable row level security;

create policy "Authenticated users can read startups"
  on public.startup_companies for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read startup people"
  on public.startup_people for select
  using (auth.role() = 'authenticated');

comment on table public.startup_companies is 'Global catalog of venture-backed startups scraped from public directories; searched by the Lead Generator in place of live web search.';
comment on table public.startup_people is 'Founders/leadership scraped from each startup company page.';
