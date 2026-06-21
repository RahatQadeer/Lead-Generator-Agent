-- Store email tone used for each outreach draft (EMAIL-003)
alter table public.outreach_emails
  add column if not exists tone text not null default 'professional'
  check (tone in ('professional', 'friendly', 'formal', 'direct'));
