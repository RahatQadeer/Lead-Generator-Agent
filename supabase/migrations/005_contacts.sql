-- Decision-maker contacts discovered at target companies
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  search_id uuid references public.searches (id) on delete set null,
  dedup_key text not null,
  provider text not null,
  provider_contact_id text,
  first_name text not null,
  last_name text,
  full_name text not null,
  title text not null,
  email text,
  linkedin_url text,
  first_discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);

create index if not exists contacts_user_id_idx on public.contacts (user_id);
create index if not exists contacts_company_id_idx on public.contacts (company_id);
create index if not exists contacts_search_id_idx on public.contacts (search_id);

alter table public.contacts enable row level security;

create policy "Users can view own contacts"
  on public.contacts for select
  using (auth.uid() = user_id);

create policy "Users can create own contacts"
  on public.contacts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own contacts"
  on public.contacts for update
  using (auth.uid() = user_id);

create policy "Users can delete own contacts"
  on public.contacts for delete
  using (auth.uid() = user_id);
