-- Reply tracking on sent outreach emails (TRACK-001)
alter table public.outreach_emails
  add column if not exists reply_status text not null default 'none'
    check (reply_status in ('none', 'replied')),
  add column if not exists replied_at timestamptz,
  add column if not exists reply_snippet text,
  add column if not exists provider_thread_id text,
  add column if not exists reply_checked_at timestamptz;

create index if not exists outreach_emails_reply_status_idx
  on public.outreach_emails (user_id, reply_status)
  where status = 'sent';
