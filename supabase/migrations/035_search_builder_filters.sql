-- ────────────────────────────────────────────────────────────────────────────
-- Search builder: the filters the lead-generation pipeline actually accepts,
-- plus the two result tables the pipeline had nowhere to write to.
--
-- The original `searches` table predates the provider pipeline: it stores a
-- SINGLE `country` and a SINGLE `industry`, and has no notion of company type,
-- funding stage, recency, contact types, or which providers to run. Every one of
-- those is a filter the pipeline supports today, so without these columns the
-- search builder can collect them but not save them.
--
-- Additive and nullable throughout — existing searches keep working untouched,
-- and the legacy `country` / `industry` columns are retained (see the backfill
-- at the bottom) so nothing reading them breaks during the transition.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.searches
  -- Multi-select geography. `country` stays as the legacy single value.
  add column if not exists countries text[] not null default '{}',
  -- Multi-select industries. `industry` stays as the legacy single value.
  add column if not exists industries text[] not null default '{}',
  -- startup | scale-up | enterprise
  add column if not exists company_type text,
  -- pre_seed | seed | series_a | series_b | series_c | series_d_plus | public |
  -- acquired | bootstrapped — matches FundingStage in lib/scraping/funding-stage.
  add column if not exists funding_stages text[] not null default '{}',
  -- "Funded in the last N months". Null = no recency filter.
  add column if not exists recently_funded_months integer,
  -- Decision-maker ladder keys (founder, ceo, cto, …) from
  -- lib/contact-discovery/decision-maker-ladder. Stored as keys, not labels, so
  -- renaming a label cannot orphan a saved search.
  add column if not exists role_keys text[] not null default '{}',
  -- Which channels to collect: linkedin | work_email | phone | website |
  -- contact_page | twitter | github
  add column if not exists contact_types text[] not null default '{}',
  -- Provider ids to run, e.g. {scraper:ycombinator, website-people}. Empty means
  -- "every enabled provider", so an existing search keeps current behaviour.
  add column if not exists enabled_providers text[] not null default '{}',
  -- Last run bookkeeping, so the list can show freshness without a join.
  add column if not exists last_run_at timestamptz,
  add column if not exists last_job_id uuid;

comment on column public.searches.enabled_providers is
  'Provider ids to run. Empty = every enabled provider, preserving pre-existing behaviour.';
comment on column public.searches.role_keys is
  'Decision-maker ladder keys, not display labels, so renaming a label cannot orphan a saved search.';

-- Backfill the multi-value columns from the legacy single-value ones so an
-- existing search behaves identically the first time it is opened in the new
-- builder. Guarded so re-running the migration is a no-op.
update public.searches
   set countries = array[country]
 where country is not null
   and country <> ''
   and coalesce(array_length(countries, 1), 0) = 0;

update public.searches
   set industries = array[industry]
 where industry is not null
   and industry <> ''
   and coalesce(array_length(industries, 1), 0) = 0;

-- ── funding events ──────────────────────────────────────────────────────────
-- Written by the pipeline's funding phase. One row per disclosed round.
create table if not exists public.funding_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,

  round text,
  stage text,
  -- Kept as text: sources disclose amounts in incompatible units and currencies
  -- ("$12M", "€3.5m", "undisclosed") and normalizing them destroys information.
  amount text,
  currency text,
  investors text[] not null default '{}',
  announced_on date,

  -- Source attribution, required for every field the pipeline stores.
  source text not null,
  source_url text,
  confidence numeric(4, 3) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Re-running a search must update a round, not duplicate it.
  unique (company_id, source, round, announced_on)
);

create index if not exists funding_events_company_idx on public.funding_events (company_id);
create index if not exists funding_events_user_idx on public.funding_events (user_id);
create index if not exists funding_events_stage_idx on public.funding_events (lower(stage));

alter table public.funding_events enable row level security;

create policy "Users can view own funding events"
  on public.funding_events for select
  using (auth.uid() = user_id);

-- ── search results ──────────────────────────────────────────────────────────
-- Joins a run to the companies it produced, so a search's history is queryable
-- without re-deriving it from the companies table.
create table if not exists public.search_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  search_id uuid not null references public.searches (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  -- The scraper_jobs row for the run that produced this result.
  job_id uuid,

  -- Which provider surfaced this company, and how sure the pipeline was.
  source_provider text,
  confidence numeric(4, 3) not null default 0,
  people_found integer not null default 0,
  contacts_found integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One row per company per search; a re-run updates it.
  unique (search_id, company_id)
);

create index if not exists search_results_search_idx on public.search_results (search_id);
create index if not exists search_results_company_idx on public.search_results (company_id);
create index if not exists search_results_job_idx on public.search_results (job_id);

alter table public.search_results enable row level security;

create policy "Users can view own search results"
  on public.search_results for select
  using (auth.uid() = user_id);

comment on table public.search_results is
  'Join of a search run to the companies it produced, with per-result provider attribution and confidence.';
