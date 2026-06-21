-- Search criteria for company discovery
create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  industry text,
  company_size_min integer,
  company_size_max integer,
  country text,
  keywords text[] not null default '{}',
  technologies text[] not null default '{}',
  job_titles text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists searches_user_id_idx on public.searches (user_id);

alter table public.searches enable row level security;

create policy "Users can view own searches"
  on public.searches for select
  using (auth.uid() = user_id);

create policy "Users can create own searches"
  on public.searches for insert
  with check (auth.uid() = user_id);

create policy "Users can update own searches"
  on public.searches for update
  using (auth.uid() = user_id);

create policy "Users can delete own searches"
  on public.searches for delete
  using (auth.uid() = user_id);
