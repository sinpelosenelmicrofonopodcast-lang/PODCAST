-- Fix signup failures ("Database error saving new user")
-- Safe to run multiple times.
-- Rebuilds auth.users triggers so a broken custom trigger cannot block signup.

do $$
declare
  _trigger record;
begin
  for _trigger in
    select tgname
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
  loop
    execute format('drop trigger if exists %I on auth.users;', _trigger.tgname);
  end loop;
end$$;

create or replace function public.handle_new_public_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _nickname_raw text;
  _nickname_base text;
  _nickname text;
  _birth_date date;
  _is_21 boolean;
  _legal_ack_at timestamptz;
  _terms_accepted boolean;
  _has_terms_accepted boolean;
  _suffix int := 0;
begin
  _nickname_raw := nullif(trim(coalesce(new.raw_user_meta_data ->> 'nickname', split_part(new.email, '@', 1))), '');
  _nickname_base := lower(regexp_replace(coalesce(_nickname_raw, ''), '[^a-z0-9_]+', '', 'g'));
  if _nickname_base = '' then
    _nickname_base := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  _nickname := _nickname_base;
  while exists (select 1 from public.users u where u.nickname = _nickname and u.id <> new.id) loop
    _suffix := _suffix + 1;
    _nickname := _nickname_base || '_' || _suffix::text;
  end loop;

  _birth_date := nullif(new.raw_user_meta_data ->> 'birth_date', '')::date;
  _is_21 := coalesce((new.raw_user_meta_data ->> 'is_21_confirmed')::boolean, false);
  _legal_ack_at := nullif(new.raw_user_meta_data ->> 'legal_ack_at', '')::timestamptz;
  _terms_accepted := coalesce((new.raw_user_meta_data ->> 'terms_accepted')::boolean, true);

  -- If signup came from a flow without profile fields, do not block auth signup.
  if _birth_date is null then
    return new;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'terms_accepted'
  ) into _has_terms_accepted;

  if _has_terms_accepted then
    insert into public.users (id, nickname, birth_date, is_21_confirmed, legal_ack_at, created_at, terms_accepted)
    values (new.id, _nickname, _birth_date, _is_21, _legal_ack_at, now(), _terms_accepted)
    on conflict (id) do update
    set nickname = excluded.nickname,
        birth_date = excluded.birth_date,
        is_21_confirmed = excluded.is_21_confirmed,
        legal_ack_at = excluded.legal_ack_at,
        terms_accepted = excluded.terms_accepted;
  else
    insert into public.users (id, nickname, birth_date, is_21_confirmed, legal_ack_at, created_at)
    values (new.id, _nickname, _birth_date, _is_21, _legal_ack_at, now())
    on conflict (id) do update
    set nickname = excluded.nickname,
        birth_date = excluded.birth_date,
        is_21_confirmed = excluded.is_21_confirmed,
        legal_ack_at = excluded.legal_ack_at;
  end if;

  return new;
exception
  when others then
    -- Never block auth signup from profile sync errors.
    return new;
end;
$$;

create or replace function public.handle_user_private_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _first_name text;
  _last_name text;
begin
  _first_name := nullif(trim(new.raw_user_meta_data ->> 'first_name'), '');
  _last_name := nullif(trim(new.raw_user_meta_data ->> 'last_name'), '');

  if _first_name is null or _last_name is null then
    return new;
  end if;

  -- If public.users was not inserted (legacy/missing columns), do not block auth signup.
  if not exists (select 1 from public.users u where u.id = new.id) then
    return new;
  end if;

  insert into public.user_private_profiles (user_id, first_name, last_name)
  values (new.id, _first_name, _last_name)
  on conflict (user_id) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      updated_at = now();

  return new;
exception
  when others then
    -- Never block auth signup from private profile sync errors.
    return new;
end;
$$;

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
exception
  when others then
    -- Never block auth signup if mic_brawl tables are missing/outdated.
    return new;
end;
$$;

create trigger on_auth_user_create_public_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_public_user();

create trigger on_auth_user_private_profile_created
  after insert on auth.users
  for each row execute procedure public.handle_user_private_profile();

create trigger trg_mic_brawl_ensure_profile
  after insert on auth.users
  for each row execute function public.mic_brawl_ensure_profile();

