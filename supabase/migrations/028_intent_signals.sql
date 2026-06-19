-- Intent-to-buy signals detected during lead scoring
alter table public.contacts
  add column if not exists intent_score integer check (intent_score >= 0 and intent_score <= 100),
  add column if not exists intent_signals jsonb;
