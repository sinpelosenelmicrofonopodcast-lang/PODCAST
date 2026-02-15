-- Fix "infinite recursion detected in policy for relation user_roles"
-- Root cause: admin-check policies query public.user_roles while RLS is enabled on public.user_roles,
-- and user_roles policies themselves also query public.user_roles.
--
-- Solution: a SECURITY DEFINER function that checks admin membership with row_security disabled,
-- then rewrite admin policies to call it (no subquery back into user_roles under RLS).

create or replace function public.is_admin(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_uid
      and r.name = 'admin'
  );
$$;

-- roles: read-only for everyone
alter table public.roles enable row level security;
drop policy if exists "roles public read" on public.roles;
create policy "roles public read" on public.roles for select using (true);

-- user_roles: self read + admin all (using is_admin)
alter table public.user_roles enable row level security;
drop policy if exists "user roles self read" on public.user_roles;
create policy "user roles self read" on public.user_roles for select using (auth.uid() = user_id);

drop policy if exists "user roles admin all" on public.user_roles;
create policy "user roles admin all"
  on public.user_roles
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- users admin update any
alter table public.users enable row level security;
drop policy if exists "users admin update any" on public.users;
create policy "users admin update any"
  on public.users
  for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- memberships admin read
alter table public.memberships enable row level security;
drop policy if exists "memberships admin read" on public.memberships;
create policy "memberships admin read"
  on public.memberships
  for select
  using (public.is_admin(auth.uid()));

-- home_settings / promotions / live_events admin all
alter table public.home_settings enable row level security;
drop policy if exists "home settings admin all" on public.home_settings;
create policy "home settings admin all"
  on public.home_settings
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

alter table public.promotions enable row level security;
drop policy if exists "promotions admin all" on public.promotions;
create policy "promotions admin all"
  on public.promotions
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

alter table public.live_events enable row level security;
drop policy if exists "live events admin all" on public.live_events;
create policy "live events admin all"
  on public.live_events
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- guest_requests admin
alter table public.guest_requests enable row level security;
drop policy if exists "guest requests admin update" on public.guest_requests;
create policy "guest requests admin update"
  on public.guest_requests
  for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "guest requests admin read" on public.guest_requests;
create policy "guest requests admin read"
  on public.guest_requests
  for select
  using (public.is_admin(auth.uid()));

-- page_visits admin read
alter table public.page_visits enable row level security;
drop policy if exists "page visits admin read" on public.page_visits;
create policy "page visits admin read"
  on public.page_visits
  for select
  using (public.is_admin(auth.uid()));

-- user_private_profiles admin read
alter table public.user_private_profiles enable row level security;
drop policy if exists "private profile admin read" on public.user_private_profiles;
create policy "private profile admin read"
  on public.user_private_profiles
  for select
  using (public.is_admin(auth.uid()));

-- publish_queue / reports admin all
alter table public.publish_queue enable row level security;
drop policy if exists "publish queue admin all" on public.publish_queue;
create policy "publish queue admin all"
  on public.publish_queue
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

alter table public.reports enable row level security;
drop policy if exists "reports admin all" on public.reports;
create policy "reports admin all"
  on public.reports
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

