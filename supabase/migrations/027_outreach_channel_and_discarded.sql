-- Outreach channel + discard flag for enriched contacts
alter table public.contacts
  add column if not exists outreach_channel text
    check (outreach_channel in ('email', 'linkedin')),
  add column if not exists discarded_at timestamptz;

create index if not exists contacts_outreach_channel_idx
  on public.contacts (user_id, outreach_channel)
  where discarded_at is null;
