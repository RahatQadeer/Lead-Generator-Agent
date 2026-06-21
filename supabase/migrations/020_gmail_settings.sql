-- Per-user Gmail sending configuration (SET-002)
create table if not exists public.gmail_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sending_provider text not null default 'mock'
    check (sending_provider in ('mock', 'gmail')),
  updated_at timestamptz not null default now()
);

alter table public.gmail_settings enable row level security;

create policy "Users can view own gmail settings"
  on public.gmail_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own gmail settings"
  on public.gmail_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own gmail settings"
  on public.gmail_settings for update
  using (auth.uid() = user_id);

create policy "Users can delete own gmail settings"
  on public.gmail_settings for delete
  using (auth.uid() = user_id);
