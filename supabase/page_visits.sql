-- Analytics: track page visitors and visits

create table if not exists public.page_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  user_id uuid references public.users(id) on delete set null,
  path text not null default '/',
  referrer text,
  user_agent text,
  visited_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists page_visits_visited_at_idx on public.page_visits(visited_at desc);
create index if not exists page_visits_visitor_id_idx on public.page_visits(visitor_id);
create index if not exists page_visits_path_idx on public.page_visits(path);

alter table public.page_visits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'page_visits'
      and policyname = 'page visits public insert'
  ) then
    create policy "page visits public insert"
      on public.page_visits
      for insert
      with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'page_visits'
      and policyname = 'page visits admin read'
  ) then
    create policy "page visits admin read"
      on public.page_visits
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

