-- Auto Posts scheduler for Facebook Page.
-- Stores queued posts and supports safe cron claiming via SKIP LOCKED.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'facebook_page',
  message text not null,
  media_url text,
  scheduled_for timestamptz not null,
  status text not null default 'queued',
  posted_at timestamptz,
  remote_id text,
  error text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_posts_status_check check (status in ('queued', 'publishing', 'posted', 'failed', 'cancelled'))
);

create index if not exists scheduled_posts_status_scheduled_for_idx
  on public.scheduled_posts (status, scheduled_for);

create index if not exists scheduled_posts_scheduled_for_idx
  on public.scheduled_posts (scheduled_for);

create unique index if not exists scheduled_posts_platform_scheduled_for_unique
  on public.scheduled_posts (platform, scheduled_for);

create or replace function public.scheduled_posts_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_scheduled_posts_set_updated_at on public.scheduled_posts;
create trigger trg_scheduled_posts_set_updated_at
before update on public.scheduled_posts
for each row
execute function public.scheduled_posts_set_updated_at();

alter table public.scheduled_posts enable row level security;

drop policy if exists "scheduled_posts admin all" on public.scheduled_posts;
create policy "scheduled_posts admin all"
on public.scheduled_posts
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

create or replace function public.claim_due_scheduled_posts(p_limit integer default 5)
returns setof public.scheduled_posts
language plpgsql
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 50));
begin
  return query
  with claimed as (
    select sp.id
    from public.scheduled_posts sp
    where sp.status = 'queued'
      and sp.platform = 'facebook_page'
      and sp.scheduled_for <= now()
    order by sp.scheduled_for asc
    for update skip locked
    limit v_limit
  ), updated as (
    update public.scheduled_posts sp
    set status = 'publishing',
        error = null,
        updated_at = now()
    where sp.id in (select id from claimed)
    returning sp.*
  )
  select * from updated order by scheduled_for asc;
end;
$$;

commit;
