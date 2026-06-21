-- Gmail OAuth connection for sending outreach (EMAIL-004)
create table if not exists public.gmail_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gmail_address text not null,
  refresh_token text not null,
  access_token text,
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gmail_connections enable row level security;

create policy "Users can view own gmail connection"
  on public.gmail_connections for select
  using (auth.uid() = user_id);

create policy "Users can upsert own gmail connection"
  on public.gmail_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own gmail connection"
  on public.gmail_connections for update
  using (auth.uid() = user_id);

create policy "Users can delete own gmail connection"
  on public.gmail_connections for delete
  using (auth.uid() = user_id);
