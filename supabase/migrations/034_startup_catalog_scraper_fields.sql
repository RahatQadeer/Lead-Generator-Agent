-- ────────────────────────────────────────────────────────────────────────────
-- Startup catalog: fields produced by the directory scrapers that migration 033
-- left no home for.
--
-- Accelerator and VC-portfolio sources publish several facts the original
-- catalog could not store: the cohort a company was funded in, whether the
-- portfolio listing is still active or has exited, and multiple published role
-- inboxes rather than a single one. Without these the catalog silently drops
-- the strongest recency and qualification signals a directory offers.
--
-- All columns are additive and nullable (or default to empty), so every scraper
-- already writing to the catalog keeps working unchanged.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.startup_companies
  -- Cohort label as published, e.g. "Winter 2024". For an accelerator the batch
  -- IS the funding event, which makes it the only recency signal these sources
  -- give us — filtering "funded in the last N months" depends on it.
  add column if not exists batch text,
  -- How the source currently classifies the listing: active | acquired | ipo |
  -- exited | inactive. An acquired company is rarely a viable lead.
  add column if not exists portfolio_status text,
  add column if not exists founded_year integer,
  -- Kept as text: sources disclose funding in incompatible units and currencies
  -- ("$12M", "€3.5m", "undisclosed") and normalizing them loses information.
  add column if not exists total_funding text,
  add column if not exists logo_url text,
  add column if not exists crunchbase_url text,
  add column if not exists product_hunt_url text,
  -- Role inboxes / business numbers. `public_email` and `public_phone` remain
  -- the primary single value for existing readers; these hold the full set.
  add column if not exists public_emails text[] not null default '{}',
  add column if not exists public_phones text[] not null default '{}';

create index if not exists startup_companies_batch_idx
  on public.startup_companies (batch);
create index if not exists startup_companies_founded_year_idx
  on public.startup_companies (founded_year);
create index if not exists startup_companies_portfolio_status_idx
  on public.startup_companies (lower(portfolio_status));

comment on column public.startup_companies.batch is
  'Accelerator cohort label as published (e.g. "Winter 2024"); for accelerators this is the funding event and the primary recency signal.';
comment on column public.startup_companies.portfolio_status is
  'Listing status as reported by the source: active | acquired | ipo | exited | inactive.';
comment on column public.startup_companies.public_emails is
  'All published business role inboxes (hello@, careers@). Never personal addresses.';

-- Founder detail the directory pages expose beyond name/title/LinkedIn.
alter table public.startup_people
  add column if not exists twitter_url text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists source_url text;
