-- Company verification & cross-source corroboration (Step 2 validation pipeline).
-- Records the outcome of website liveness/quality checks, deterministic semantic
-- matching, and the >=2-trusted-source cross-verification gate.
alter table companies
  add column if not exists validation_status text,
  add column if not exists website_status text,
  add column if not exists semantic_relevance integer,
  add column if not exists quality_score integer,
  add column if not exists sources jsonb not null default '[]'::jsonb;


-- Fast filtering of dashboards by verification verdict (verified / needs_verification).
create index if not exists companies_validation_status_idx
  on companies (user_id, validation_status);
