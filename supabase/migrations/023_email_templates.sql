-- Per-user outreach email templates (SET-005)
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  tone text not null
    check (tone in ('professional', 'friendly', 'formal', 'direct')),
  subject_template text not null,
  body_template text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_templates_user_id_idx
  on public.email_templates (user_id);

create unique index if not exists email_templates_user_tone_default_idx
  on public.email_templates (user_id, tone)
  where is_default = true;

alter table public.email_templates enable row level security;

create policy "Users can view own email templates"
  on public.email_templates for select
  using (auth.uid() = user_id);

create policy "Users can create own email templates"
  on public.email_templates for insert
  with check (auth.uid() = user_id);

create policy "Users can update own email templates"
  on public.email_templates for update
  using (auth.uid() = user_id);

create policy "Users can delete own email templates"
  on public.email_templates for delete
  using (auth.uid() = user_id);
