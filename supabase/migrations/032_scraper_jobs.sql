-- Directory scraper job tracking (multi-source startup directory engine)
create table if not exists public.scraper_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  search_id uuid references public.searches (id) on delete set null,
  sources text[] not null,
  status text not null default 'pending',
  options jsonb not null default '{}'::jsonb,
  report jsonb,
  error_log jsonb not null default '[]'::jsonb,
  bullmq_job_id text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scraper_jobs_user_id_idx on public.scraper_jobs (user_id);
create index if not exists scraper_jobs_status_idx on public.scraper_jobs (user_id, status);
create index if not exists scraper_jobs_created_at_idx on public.scraper_jobs (user_id, created_at desc);

alter table public.scraper_jobs enable row level security;

create policy "Users can view own scraper jobs"
  on public.scraper_jobs for select
  using (auth.uid() = user_id);

create policy "Users can create own scraper jobs"
  on public.scraper_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own scraper jobs"
  on public.scraper_jobs for update
  using (auth.uid() = user_id);

-- Rich directory scrape payload (founders, socials, page URLs, etc.)
alter table public.companies
  add column if not exists directory_profile jsonb;

comment on table public.scraper_jobs is 'Background directory scraper runs (YC, Product Hunt, etc.)';
comment on column public.companies.directory_profile is 'Extended public profile from directory scrapers';
