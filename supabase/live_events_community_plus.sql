-- Community Events Pro schema (non-breaking, additive).

alter table if exists public.live_events
  add column if not exists event_type text,
  add column if not exists venue_name text,
  add column if not exists address_line text,
  add column if not exists city text,
  add column if not exists organizer_name text,
  add column if not exists organizer_logo_url text,
  add column if not exists organizer_instagram text,
  add column if not exists organizer_facebook text,
  add column if not exists organizer_website text,
  add column if not exists organizer_phone text,
  add column if not exists info_url text,
  add column if not exists ticket_url text,
  add column if not exists flyer_url text,
  add column if not exists gallery_urls text[] default '{}'::text[],
  add column if not exists promo_video_url text,
  add column if not exists map_url text,
  add column if not exists is_free boolean default true,
  add column if not exists price_general text,
  add column if not exists price_vip text,
  add column if not exists age_policy text default 'all_ages',
  add column if not exists parking_available boolean default false,
  add column if not exists kids_allowed boolean default false,
  add column if not exists food_available boolean default false,
  add column if not exists alcohol_available boolean default false,
  add column if not exists byob_allowed boolean default false,
  add column if not exists wheelchair_access boolean default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_events_event_type_check'
      and conrelid = 'public.live_events'::regclass
  ) then
    alter table public.live_events
      add constraint live_events_event_type_check
      check (
        event_type is null
        or event_type in (
          'musica',
          'comedia',
          'festival',
          'negocios',
          'familia',
          'food_truck',
          'deportes',
          'otro'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_events_age_policy_check'
      and conrelid = 'public.live_events'::regclass
  ) then
    alter table public.live_events
      add constraint live_events_age_policy_check
      check (
        age_policy in ('all_ages', '18_plus', '21_plus')
      );
  end if;
end $$;

create index if not exists live_events_starts_at_idx on public.live_events(starts_at);
create index if not exists live_events_city_idx on public.live_events(city);
create index if not exists live_events_type_idx on public.live_events(event_type);
create index if not exists live_events_updated_idx on public.live_events(updated_at desc);

create table if not exists public.event_rsvps (
  event_id uuid not null references public.live_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_rsvps_status_check'
      and conrelid = 'public.event_rsvps'::regclass
  ) then
    alter table public.event_rsvps
      add constraint event_rsvps_status_check
      check (status in ('interested', 'going'));
  end if;
end $$;

create index if not exists event_rsvps_event_status_idx on public.event_rsvps(event_id, status);
create index if not exists event_rsvps_user_idx on public.event_rsvps(user_id);

create or replace function public.event_rsvps_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_event_rsvps_updated_at on public.event_rsvps;
create trigger trg_event_rsvps_updated_at
before update on public.event_rsvps
for each row
execute function public.event_rsvps_set_updated_at();

alter table public.event_rsvps enable row level security;

drop policy if exists "event_rsvps auth read" on public.event_rsvps;
create policy "event_rsvps auth read"
on public.event_rsvps
for select
using (auth.uid() is not null);

drop policy if exists "event_rsvps own insert" on public.event_rsvps;
create policy "event_rsvps own insert"
on public.event_rsvps
for insert
with check (auth.uid() = user_id);

drop policy if exists "event_rsvps own update" on public.event_rsvps;
create policy "event_rsvps own update"
on public.event_rsvps
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "event_rsvps own delete" on public.event_rsvps;
create policy "event_rsvps own delete"
on public.event_rsvps
for delete
using (auth.uid() = user_id);
