-- Per-user Outlook sending configuration (SET-003)
create table if not exists public.outlook_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sending_provider text not null default 'mock'
    check (sending_provider in ('mock', 'outlook')),
  updated_at timestamptz not null default now()
);

alter table public.outlook_settings enable row level security;

create policy "Users can view own outlook settings"
  on public.outlook_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own outlook settings"
  on public.outlook_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own outlook settings"
  on public.outlook_settings for update
  using (auth.uid() = user_id);

create policy "Users can delete own outlook settings"
  on public.outlook_settings for delete
  using (auth.uid() = user_id);
