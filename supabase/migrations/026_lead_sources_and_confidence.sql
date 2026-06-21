-- Track how contact details were obtained + enrichment metadata
alter table contacts
  add column if not exists email_source text,
  add column if not exists linkedin_source text;

alter table companies
  add column if not exists industry_detected text,
  add column if not exists industry_verified boolean default false;
