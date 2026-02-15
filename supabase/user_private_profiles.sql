-- Private legal identity data (only admins can read)

create table if not exists public.user_private_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_private_profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_private_profiles'
      and policyname = 'private profile self insert'
  ) then
    create policy "private profile self insert"
      on public.user_private_profiles
      for insert
      with check (auth.uid() = user_id);
  end if;
end$$;

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

  insert into public.user_private_profiles (user_id, first_name, last_name)
  values (new.id, _first_name, _last_name)
  on conflict (user_id) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_private_profile_created on auth.users;
create trigger on_auth_user_private_profile_created
  after insert on auth.users
  for each row execute procedure public.handle_user_private_profile();

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_private_profiles'
      and policyname = 'private profile self update'
  ) then
    create policy "private profile self update"
      on public.user_private_profiles
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_private_profiles'
      and policyname = 'private profile admin read'
  ) then
    create policy "private profile admin read"
      on public.user_private_profiles
      for select
      using (
        exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid()
            and r.name = 'admin'
        )
      );
  end if;
end$$;
