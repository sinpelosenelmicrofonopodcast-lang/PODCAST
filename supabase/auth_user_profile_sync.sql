-- Keep public.users in sync with auth.users on sign up (so admin/users sees everyone)
-- Requires that signUp sends: nickname, birth_date, is_21_confirmed, legal_ack_at, terms_accepted (or terms_accepted=true)

create or replace function public.handle_new_public_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _nickname text;
  _birth_date date;
  _is_21 boolean;
  _legal_ack_at timestamptz;
  _terms_accepted boolean;
begin
  _nickname := nullif(trim(new.raw_user_meta_data ->> 'nickname'), '');
  _birth_date := nullif(new.raw_user_meta_data ->> 'birth_date', '')::date;
  _is_21 := coalesce((new.raw_user_meta_data ->> 'is_21_confirmed')::boolean, false);
  _legal_ack_at := nullif(new.raw_user_meta_data ->> 'legal_ack_at', '')::timestamptz;
  _terms_accepted := coalesce((new.raw_user_meta_data ->> 'terms_accepted')::boolean, true);

  -- If required fields are missing, do nothing. The app can prompt user to complete profile.
  if _nickname is null or _birth_date is null then
    return new;
  end if;

  insert into public.users (id, nickname, birth_date, is_21_confirmed, legal_ack_at, created_at, terms_accepted)
  values (new.id, _nickname, _birth_date, _is_21, _legal_ack_at, now(), _terms_accepted)
  on conflict (id) do update
  set nickname = excluded.nickname,
      birth_date = excluded.birth_date,
      is_21_confirmed = excluded.is_21_confirmed,
      legal_ack_at = excluded.legal_ack_at,
      terms_accepted = excluded.terms_accepted;

  return new;
exception
  when others then
    -- Avoid blocking signup if constraints reject the profile row.
    return new;
end;
$$;

drop trigger if exists on_auth_user_create_public_profile on auth.users;
create trigger on_auth_user_create_public_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_public_user();

