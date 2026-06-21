-- Company profile enrichment fields
alter table public.companies
  add column if not exists description text,
  add column if not exists confidence_score smallint,
  add column if not exists scraped_at timestamptz;

-- Contact quality fields
alter table public.contacts
  add column if not exists department text,
  add column if not exists confidence_score smallint,
  add column if not exists email_is_guessed boolean not null default false,
  add column if not exists email_display_status text,
  add column if not exists scraped_at timestamptz;

-- Shared scrape cache (companies, people, page HTML metadata)
create table if not exists public.scrape_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  cache_type text not null check (cache_type in ('company', 'contacts', 'page')),
  payload jsonb not null,
  scraped_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists scrape_cache_expires_at_idx on public.scrape_cache (expires_at);
create index if not exists scrape_cache_type_key_idx on public.scrape_cache (cache_type, cache_key);

alter table public.scrape_cache enable row level security;

-- Service role / workers only (no user-facing RLS policies)
comment on table public.scrape_cache is 'TTL cache for scraped company and contact data';
