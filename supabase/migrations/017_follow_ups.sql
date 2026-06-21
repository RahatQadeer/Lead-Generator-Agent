-- Follow-up scheduling with reply-based cancellation (TRACK-002)
alter table public.contacts
  add column if not exists follow_ups_paused boolean not null default false,
  add column if not exists follow_ups_paused_reason text,
  add column if not exists follow_ups_paused_at timestamptz;

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  source_email_id uuid not null references public.outreach_emails (id) on delete cascade,
  sequence_number integer not null default 1,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'sent', 'skipped')),
  cancel_reason text check (cancel_reason in ('replied', 'manual')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists follow_ups_user_id_idx on public.follow_ups (user_id);
create index if not exists follow_ups_contact_id_idx on public.follow_ups (contact_id);
create index if not exists follow_ups_status_scheduled_idx
  on public.follow_ups (user_id, status, scheduled_at)
  where status = 'scheduled';

alter table public.follow_ups enable row level security;

create policy "Users can view own follow ups"
  on public.follow_ups for select
  using (auth.uid() = user_id);

create policy "Users can create own follow ups"
  on public.follow_ups for insert
  with check (auth.uid() = user_id);

create policy "Users can update own follow ups"
  on public.follow_ups for update
  using (auth.uid() = user_id);
