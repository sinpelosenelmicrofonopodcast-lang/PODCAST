-- Table for "Quiero salir en Sin Pelos" form leads
create table if not exists public.guest_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  availability text not null,
  topic text not null,
  details text,
  social_url text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'guest_requests_status_check'
  ) then
    alter table public.guest_requests
    add constraint guest_requests_status_check
    check (status in ('new', 'contacted', 'closed'));
  end if;
end$$;

alter table public.guest_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'guest_requests'
      and policyname = 'guest requests public insert'
  ) then
    create policy "guest requests public insert"
      on public.guest_requests
      for insert
      with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'guest_requests'
      and policyname = 'guest requests admin update'
  ) then
    create policy "guest requests admin update"
      on public.guest_requests
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
      and tablename = 'guest_requests'
      and policyname = 'guest requests admin read'
  ) then
    create policy "guest requests admin read"
      on public.guest_requests
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
