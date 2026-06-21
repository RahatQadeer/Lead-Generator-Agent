-- Discovered companies for duplicate detection across searches
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  search_id uuid references public.searches (id) on delete set null,
  dedup_key text not null,
  provider text not null,
  provider_company_id text,
  name text not null,
  domain text,
  industry text,
  employee_count integer,
  country text,
  city text,
  state text,
  linkedin_url text,
  website_url text,
  technologies text[],
  first_discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);

create index if not exists companies_user_id_idx on public.companies (user_id);
create index if not exists companies_search_id_idx on public.companies (search_id);

alter table public.companies enable row level security;

create policy "Users can view own companies"
  on public.companies for select
  using (auth.uid() = user_id);

create policy "Users can create own companies"
  on public.companies for insert
  with check (auth.uid() = user_id);

create policy "Users can update own companies"
  on public.companies for update
  using (auth.uid() = user_id);

create policy "Users can delete own companies"
  on public.companies for delete
  using (auth.uid() = user_id);
