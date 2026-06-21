-- Lead scoring fields (LEAD-004)
alter table public.contacts
  add column if not exists lead_score integer check (lead_score >= 1 and lead_score <= 10),
  add column if not exists lead_score_factors jsonb,
  add column if not exists lead_scored_at timestamptz;
