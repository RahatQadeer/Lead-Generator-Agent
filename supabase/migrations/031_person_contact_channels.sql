-- Person-level contact channels: direct phone + personal social profiles.
-- Phone/socials here are always tied to the individual (name-matched handle, or a
-- tel: link inside that person's own card) — never the company switchboard or the
-- company's own social accounts, which already live on the companies table.
alter table public.contacts
  add column if not exists phone text,
  add column if not exists phone_source text
    check (phone_source is null or phone_source in ('website', 'pdl')),
  add column if not exists social_profiles jsonb;

-- 027 constrained outreach_channel to ('email','linkedin'); a phone- or social-only
-- lead is now deliverable, so that constraint has to go before the new values fit.
-- Look it up by column rather than by name: the name was auto-generated, and a stale
-- constraint left in place would reject every phone lead at insert time.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'contacts'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%outreach_channel%'
  loop
    execute format('alter table public.contacts drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.contacts
  add constraint contacts_outreach_channel_check
    check (outreach_channel is null or outreach_channel in ('email', 'linkedin', 'phone', 'social'));

create index if not exists contacts_phone_idx
  on public.contacts (user_id, phone)
  where discarded_at is null and phone is not null;
