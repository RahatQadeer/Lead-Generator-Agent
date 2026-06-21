-- Outreach campaign batch sends (EMAIL-006)
create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Outreach campaign',
  status text not null default 'running'
    check (status in ('running', 'completed', 'partial', 'failed')),
  provider text not null,
  total_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outreach_campaigns_user_id_idx
  on public.outreach_campaigns (user_id);

alter table public.outreach_emails
  add column if not exists campaign_id uuid references public.outreach_campaigns (id) on delete set null;

create index if not exists outreach_emails_campaign_id_idx
  on public.outreach_emails (campaign_id);

alter table public.outreach_campaigns enable row level security;

create policy "Users can view own outreach campaigns"
  on public.outreach_campaigns for select
  using (auth.uid() = user_id);

create policy "Users can create own outreach campaigns"
  on public.outreach_campaigns for insert
  with check (auth.uid() = user_id);

create policy "Users can update own outreach campaigns"
  on public.outreach_campaigns for update
  using (auth.uid() = user_id);
