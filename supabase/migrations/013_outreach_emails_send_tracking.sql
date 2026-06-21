-- Track Gmail send metadata on outreach drafts (EMAIL-004)
alter table public.outreach_emails
  add column if not exists sent_at timestamptz,
  add column if not exists gmail_message_id text,
  add column if not exists recipient_email text;
