-- Lead profile enrichment fields (LEAD-002)
alter table public.contacts
  add column if not exists company_name text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text,
  add column if not exists enriched_at timestamptz,
  add column if not exists enrichment_provider text;
