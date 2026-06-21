-- Email verification fields (LEAD-003)
alter table public.contacts
  add column if not exists email_syntax_valid boolean,
  add column if not exists email_domain_valid boolean,
  add column if not exists email_verification_status text,
  add column if not exists email_verification_provider text,
  add column if not exists email_verification_message text,
  add column if not exists email_verified_at timestamptz;
