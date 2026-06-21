-- Discovery provenance and contact detail classification
alter table contacts
  add column if not exists source_url text,
  add column if not exists discovery_source text,
  add column if not exists contact_page_url text,
  add column if not exists contact_detail_type text;
