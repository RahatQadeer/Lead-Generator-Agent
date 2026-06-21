-- Per-user lead scoring rule weights (SET-004)
create table if not exists public.lead_scoring_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  industry_weight integer not null default 20
    check (industry_weight >= 0 and industry_weight <= 100),
  company_size_weight integer not null default 20
    check (company_size_weight >= 0 and company_size_weight <= 100),
  location_weight integer not null default 20
    check (location_weight >= 0 and location_weight <= 100),
  job_role_weight integer not null default 20
    check (job_role_weight >= 0 and job_role_weight <= 100),
  technology_weight integer not null default 20
    check (technology_weight >= 0 and technology_weight <= 100),
  updated_at timestamptz not null default now(),
  check (
    industry_weight
    + company_size_weight
    + location_weight
    + job_role_weight
    + technology_weight
    = 100
  )
);

alter table public.lead_scoring_settings enable row level security;

create policy "Users can view own lead scoring settings"
  on public.lead_scoring_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own lead scoring settings"
  on public.lead_scoring_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own lead scoring settings"
  on public.lead_scoring_settings for update
  using (auth.uid() = user_id);

create policy "Users can delete own lead scoring settings"
  on public.lead_scoring_settings for delete
  using (auth.uid() = user_id);
