-- Enforce 21+ and legal acceptance at profile level

alter table public.users
add column if not exists terms_accepted boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_must_be_21'
  ) then
    alter table public.users
    add constraint users_must_be_21
    check (birth_date <= (current_date - interval '21 years'));
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_terms_or_legal_ack'
  ) then
    alter table public.users
    add constraint users_terms_or_legal_ack
    check (terms_accepted = true and legal_ack_at is not null and is_21_confirmed = true);
  end if;
end$$;

-- Tighten existing policies to enforce legal checks on insert/update.
alter policy "users can insert own profile"
  on public.users
  with check (
    auth.uid() = id
    and is_21_confirmed = true
    and terms_accepted = true
    and legal_ack_at is not null
    and birth_date <= (current_date - interval '21 years')
  );

alter policy "users can update own profile"
  on public.users
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_21_confirmed = true
    and terms_accepted = true
    and legal_ack_at is not null
    and birth_date <= (current_date - interval '21 years')
  );

