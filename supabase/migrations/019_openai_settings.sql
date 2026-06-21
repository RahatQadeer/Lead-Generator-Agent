-- Per-user OpenAI configuration (SET-001)
create table if not exists public.openai_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  generation_provider text not null default 'mock'
    check (generation_provider in ('mock', 'openai')),
  model text not null default 'gpt-4o-mini',
  api_key text,
  updated_at timestamptz not null default now()
);

alter table public.openai_settings enable row level security;

create policy "Users can view own openai settings"
  on public.openai_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own openai settings"
  on public.openai_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own openai settings"
  on public.openai_settings for update
  using (auth.uid() = user_id);

create policy "Users can delete own openai settings"
  on public.openai_settings for delete
  using (auth.uid() = user_id);
