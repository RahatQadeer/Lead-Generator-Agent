-- AI follow-up suggestions (TRACK-003)
alter table public.follow_ups
  add column if not exists suggested_subject text,
  add column if not exists suggested_body text,
  add column if not exists suggestion_provider text,
  add column if not exists suggestion_model text,
  add column if not exists suggested_at timestamptz,
  add column if not exists draft_email_id uuid references public.outreach_emails (id) on delete set null;

create index if not exists follow_ups_draft_email_id_idx
  on public.follow_ups (draft_email_id)
  where draft_email_id is not null;
