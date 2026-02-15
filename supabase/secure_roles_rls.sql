-- SECURITY: prevent privilege escalation (regular users must NOT be able to grant themselves admin)

alter table public.roles enable row level security;
alter table public.user_roles enable row level security;

-- roles: safe to read (needed for joins), but no public writes
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roles'
      and policyname = 'roles public read'
  ) then
    create policy "roles public read"
      on public.roles
      for select
      using (true);
  end if;
end$$;

-- user_roles: allow admin manage; optionally allow users read their own roles (no writes)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_roles'
      and policyname = 'user roles self read'
  ) then
    create policy "user roles self read"
      on public.user_roles
      for select
      using (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_roles'
      and policyname = 'user roles admin all'
  ) then
    create policy "user roles admin all"
      on public.user_roles
      for all
      using (
        exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid()
            and r.name = 'admin'
        )
      )
      with check (
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

