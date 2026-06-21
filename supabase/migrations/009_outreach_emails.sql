-- AI-generated outreach email drafts (EMAIL-001)
create table if not exists public.outreach_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  subject text not null,
  body text not null,
  provider text not null,
  model text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outreach_emails_user_id_idx on public.outreach_emails (user_id);
create index if not exists outreach_emails_contact_id_idx on public.outreach_emails (contact_id);

alter table public.outreach_emails enable row level security;

create policy "Users can view own outreach emails"
  on public.outreach_emails for select
  using (auth.uid() = user_id);

create policy "Users can create own outreach emails"
  on public.outreach_emails for insert
  with check (auth.uid() = user_id);

create policy "Users can update own outreach emails"
  on public.outreach_emails for update
  using (auth.uid() = user_id);

create policy "Users can delete own outreach emails"
  on public.outreach_emails for delete
  using (auth.uid() = user_id);
