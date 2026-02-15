-- Admin controls for users management

alter table public.users
add column if not exists user_status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_status_check'
  ) then
    alter table public.users
    add constraint users_status_check
    check (user_status in ('active', 'blocked'));
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users admin update any'
  ) then
    create policy "users admin update any"
      on public.users
      for update
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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'memberships'
      and policyname = 'memberships admin read'
  ) then
    create policy "memberships admin read"
      on public.memberships
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

