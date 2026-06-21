-- Exclusion rules for search criteria
alter table public.searches
  add column if not exists exclude_domains text[] not null default '{}',
  add column if not exists exclude_industries text[] not null default '{}',
  add column if not exists exclude_keywords text[] not null default '{}',
  add column if not exists exclude_countries text[] not null default '{}';
