-- Store personalization inputs used for each outreach email (EMAIL-002)
alter table public.outreach_emails
  add column if not exists lead_company text,
  add column if not exists industry text,
  add column if not exists pain_points text[] not null default '{}';
