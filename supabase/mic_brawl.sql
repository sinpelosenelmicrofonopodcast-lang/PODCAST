-- Mic Brawl MVP schema + security
-- Safe to run multiple times.

create extension if not exists pgcrypto;

-- ========= Profiles =========
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique,
  equipped_skin text not null default 'classic',
  wins int not null default 0,
  losses int not null default 0,
  kos int not null default 0,
  matches int not null default 0,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.mic_brawl_default_handle()
returns text
language plpgsql
stable
as $$
declare
  _email text := nullif(auth.jwt() ->> 'email', '');
  _base text;
begin
  _base := lower(regexp_replace(coalesce(split_part(_email, '@', 1), ''), '[^a-z0-9_]+', '', 'g'));
  if _base is null or _base = '' then
    _base := 'player_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;
  return _base;
end;
$$;

create or replace function public.mic_brawl_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _is_admin boolean := false;
begin
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'admin'
  ) into _is_admin;

  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  -- Non-admin users can only edit handle + equipped_skin.
  if not _is_admin and auth.uid() = old.id then
    new.wins := old.wins;
    new.losses := old.losses;
    new.kos := old.kos;
    new.matches := old.matches;
    new.is_admin := old.is_admin;
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mic_brawl_profiles_guard on public.profiles;
create trigger trg_mic_brawl_profiles_guard
before update on public.profiles
for each row execute function public.mic_brawl_profiles_guard();

create or replace function public.mic_brawl_ensure_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _email text := nullif(new.email, '');
  _base text;
  _candidate text;
  _i int := 0;
begin
  _base := lower(regexp_replace(coalesce(split_part(_email, '@', 1), ''), '[^a-z0-9_]+', '', 'g'));
  if _base is null or _base = '' then
    _base := 'player_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  _candidate := _base;

  while exists (select 1 from public.profiles p where p.handle = _candidate and p.id <> new.id) loop
    _i := _i + 1;
    _candidate := _base || '_' || _i::text;
  end loop;

  insert into public.profiles (id, handle)
  values (new.id, _candidate)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_mic_brawl_ensure_profile on auth.users;
create trigger trg_mic_brawl_ensure_profile
after insert on auth.users
for each row execute function public.mic_brawl_ensure_profile();

insert into public.profiles (id, handle)
select u.id,
       lower(
         regexp_replace(
           coalesce(
             nullif(split_part(u.email, '@', 1), ''),
             'player_' || substr(replace(u.id::text, '-', ''), 1, 8)
           ),
           '[^a-z0-9_]+',
           '',
           'g'
         )
       ) as handle
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ========= Skins =========
create table if not exists public.mic_brawl_skins (
  id text primary key,
  display_name text not null,
  unlock_wins int null,
  is_active boolean not null default true,
  palette jsonb null,
  created_at timestamptz not null default now()
);

insert into public.mic_brawl_skins (id, display_name, unlock_wins, is_active, palette)
values
  ('classic', 'Classic', null, true, '{"body":"#d9d9d9","accent":"#ff3b30","mic":"#c8c8c8"}'::jsonb),
  ('neon', 'Neon', 3, true, '{"body":"#38f7ff","accent":"#ff2d95","mic":"#fff94c"}'::jsonb),
  ('gold', 'Gold', 10, true, '{"body":"#ffd23b","accent":"#ff8f00","mic":"#fff2b2"}'::jsonb)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_equipped_skin_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_equipped_skin_fkey
      foreign key (equipped_skin) references public.mic_brawl_skins(id) on update cascade on delete restrict;
  end if;
end $$;

-- ========= Rooms =========
create table if not exists public.mic_brawl_rooms (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open' check (status in ('open', 'full', 'closed', 'finished')),
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity timestamptz not null default now()
);

create or replace function public.mic_brawl_touch_room_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_mic_brawl_touch_room_updated_at on public.mic_brawl_rooms;
create trigger trg_mic_brawl_touch_room_updated_at
before update on public.mic_brawl_rooms
for each row execute function public.mic_brawl_touch_room_updated_at();

-- ========= Matches =========
create table if not exists public.mic_brawl_matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mic_brawl_rooms(id) on delete cascade,
  winner_id uuid not null references auth.users(id) on delete cascade,
  loser_id uuid not null references auth.users(id) on delete cascade,
  winner_ko boolean not null default true,
  duration_seconds int not null default 0,
  created_at timestamptz not null default now(),
  constraint mic_brawl_matches_room_unique unique (room_id),
  constraint mic_brawl_matches_diff_players check (winner_id <> loser_id)
);

-- ========= Indexes =========
create index if not exists idx_profiles_leaderboard on public.profiles (wins desc, kos desc, matches desc, created_at asc);
create index if not exists idx_profiles_handle on public.profiles (handle);
create index if not exists idx_mic_brawl_rooms_last_activity on public.mic_brawl_rooms (last_activity desc);
create index if not exists idx_mic_brawl_rooms_status on public.mic_brawl_rooms (status);
create index if not exists idx_mic_brawl_matches_created on public.mic_brawl_matches (created_at desc);
create index if not exists idx_mic_brawl_matches_winner on public.mic_brawl_matches (winner_id, created_at desc);

-- ========= RLS =========
alter table public.profiles enable row level security;
alter table public.mic_brawl_skins enable row level security;
alter table public.mic_brawl_rooms enable row level security;
alter table public.mic_brawl_matches enable row level security;

-- profiles
drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read"
on public.profiles
for select
using (true);

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles admin all" on public.profiles;
create policy "profiles admin all"
on public.profiles
for all
using (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'admin'
  )
);

-- skins
drop policy if exists "mic_brawl_skins public read active" on public.mic_brawl_skins;
create policy "mic_brawl_skins public read active"
on public.mic_brawl_skins
for select
using (is_active = true);

drop policy if exists "mic_brawl_skins admin all" on public.mic_brawl_skins;
create policy "mic_brawl_skins admin all"
on public.mic_brawl_skins
for all
using (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'admin'
  )
);

-- rooms
drop policy if exists "mic_brawl_rooms participants read" on public.mic_brawl_rooms;
create policy "mic_brawl_rooms participants read"
on public.mic_brawl_rooms
for select
using (auth.uid() = host_id or auth.uid() = guest_id);

drop policy if exists "mic_brawl_rooms self create" on public.mic_brawl_rooms;
create policy "mic_brawl_rooms self create"
on public.mic_brawl_rooms
for insert
with check (auth.uid() = host_id and status = 'open');

drop policy if exists "mic_brawl_rooms host heartbeat" on public.mic_brawl_rooms;
create policy "mic_brawl_rooms host heartbeat"
on public.mic_brawl_rooms
for update
using (auth.uid() = host_id or auth.uid() = guest_id)
with check (auth.uid() = host_id or auth.uid() = guest_id);

drop policy if exists "mic_brawl_rooms admin all" on public.mic_brawl_rooms;
create policy "mic_brawl_rooms admin all"
on public.mic_brawl_rooms
for all
using (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'admin'
  )
);

-- matches (read-only for authenticated/public; writes via RPC security definer)
drop policy if exists "mic_brawl_matches public read" on public.mic_brawl_matches;
create policy "mic_brawl_matches public read"
on public.mic_brawl_matches
for select
using (true);

drop policy if exists "mic_brawl_matches admin delete" on public.mic_brawl_matches;
create policy "mic_brawl_matches admin delete"
on public.mic_brawl_matches
for delete
using (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'admin'
  )
);

grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;
grant select on public.mic_brawl_skins to anon, authenticated;
grant select, insert, update on public.mic_brawl_rooms to authenticated;
grant select on public.mic_brawl_matches to anon, authenticated;

-- ========= RPC: finalize match atomically =========
create or replace function public.mic_brawl_finalize_match(
  p_room_id uuid,
  p_winner_id uuid,
  p_duration_seconds int default 0,
  p_winner_ko boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _room public.mic_brawl_rooms%rowtype;
  _caller uuid := auth.uid();
  _loser uuid;
  _match_id uuid;
  _duration int := greatest(5, least(coalesce(p_duration_seconds, 0), 7200));
begin
  if _caller is null then
    raise exception 'Unauthorized';
  end if;

  select *
  into _room
  from public.mic_brawl_rooms r
  where r.id = p_room_id
  for update;

  if not found then
    raise exception 'Room not found';
  end if;

  if _room.status not in ('open', 'full') then
    raise exception 'Room not active';
  end if;

  if _room.guest_id is null then
    raise exception 'Room missing second player';
  end if;

  if p_winner_id not in (_room.host_id, _room.guest_id) then
    raise exception 'Winner is not a participant';
  end if;

  if _caller not in (_room.host_id, _room.guest_id) then
    raise exception 'Caller is not a participant';
  end if;

  -- Caller must be winner or host.
  if _caller <> p_winner_id and _caller <> _room.host_id then
    raise exception 'Not allowed to finalize this match';
  end if;

  _loser := case when p_winner_id = _room.host_id then _room.guest_id else _room.host_id end;

  if exists (select 1 from public.mic_brawl_matches m where m.room_id = p_room_id) then
    select m.id into _match_id from public.mic_brawl_matches m where m.room_id = p_room_id limit 1;
    return _match_id;
  end if;

  insert into public.profiles (id, handle)
  values (p_winner_id, 'player_' || substr(replace(p_winner_id::text, '-', ''), 1, 8))
  on conflict (id) do nothing;

  insert into public.profiles (id, handle)
  values (_loser, 'player_' || substr(replace(_loser::text, '-', ''), 1, 8))
  on conflict (id) do nothing;

  insert into public.mic_brawl_matches (room_id, winner_id, loser_id, winner_ko, duration_seconds)
  values (p_room_id, p_winner_id, _loser, coalesce(p_winner_ko, true), _duration)
  returning id into _match_id;

  update public.profiles
  set wins = wins + 1,
      matches = matches + 1,
      kos = kos + case when coalesce(p_winner_ko, true) then 1 else 0 end
  where id = p_winner_id;

  update public.profiles
  set losses = losses + 1,
      matches = matches + 1
  where id = _loser;

  update public.mic_brawl_rooms
  set status = 'finished',
      last_activity = now()
  where id = p_room_id;

  return _match_id;
end;
$$;

grant execute on function public.mic_brawl_finalize_match(uuid, uuid, int, boolean) to authenticated;
