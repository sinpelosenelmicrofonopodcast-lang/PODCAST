-- Admin/RLS hardening for "Sin Pelos en el Micrófono"
-- Run this in Supabase SQL editor (project: bhuophwyhgnqhbstinqw) as an admin.
--
-- Goals:
-- 1) Regular users must NOT be able to write to admin-managed tables (promotions, home_settings, live_events, etc).
-- 2) Admin checks must be centralized via a SECURITY DEFINER function `is_admin(uid uuid)`.
-- 3) Public reading should remain open for public content (news/blog), and promotions/events as configured.
--
-- Notes:
-- - This script assumes tables already exist.
-- - If you previously had policies referencing `user_roles` directly (subqueries), that can cause recursion errors.
--   Use `is_admin(auth.uid())` instead.

begin;

-- 1) Canonical admin-check function.
-- IMPORTANT: keep parameter name `uid` (you previously hit "cannot change name of input parameter uid").
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = uid
      and r.name = 'admin'
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated;

-- Optional: allow anon to call it (won't be useful without auth.uid()).
-- grant execute on function public.is_admin(uuid) to anon;

-- 2) Lock down admin-managed tables.
-- Promotions
alter table if exists public.promotions enable row level security;
drop policy if exists "promotions public read" on public.promotions;
drop policy if exists "promotions admin write" on public.promotions;
create policy "promotions public read"
on public.promotions
for select
to anon, authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);
create policy "promotions admin write"
on public.promotions
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Home settings (public read, admin write)
alter table if exists public.home_settings enable row level security;
drop policy if exists "home_settings public read" on public.home_settings;
drop policy if exists "home_settings admin write" on public.home_settings;
create policy "home_settings public read"
on public.home_settings
for select
to anon, authenticated
using (true);
create policy "home_settings admin write"
on public.home_settings
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Live events (public read for public visibility; admin write)
alter table if exists public.live_events enable row level security;
drop policy if exists "live_events public read" on public.live_events;
drop policy if exists "live_events auth read" on public.live_events;
drop policy if exists "live_events admin write" on public.live_events;
create policy "live_events public read"
on public.live_events
for select
to anon
using (visibility = 'public');
create policy "live_events auth read"
on public.live_events
for select
to authenticated
using (visibility in ('public', 'members', 'paid'));
create policy "live_events admin write"
on public.live_events
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Guest requests (public insert, admin manage)
alter table if exists public.guest_requests enable row level security;
drop policy if exists "guest_requests public insert" on public.guest_requests;
drop policy if exists "guest_requests admin read" on public.guest_requests;
drop policy if exists "guest_requests admin update" on public.guest_requests;
drop policy if exists "guest_requests admin delete" on public.guest_requests;
create policy "guest_requests public insert"
on public.guest_requests
for insert
to anon, authenticated
with check (true);
create policy "guest_requests admin read"
on public.guest_requests
for select
to authenticated
using (public.is_admin(auth.uid()));
create policy "guest_requests admin update"
on public.guest_requests
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
create policy "guest_requests admin delete"
on public.guest_requests
for delete
to authenticated
using (public.is_admin(auth.uid()));

-- Blog posts (public read, admin write)
alter table if exists public.blog_posts enable row level security;
drop policy if exists "blog_posts public read" on public.blog_posts;
drop policy if exists "blog_posts admin write" on public.blog_posts;
create policy "blog_posts public read"
on public.blog_posts
for select
to anon, authenticated
using (true);
create policy "blog_posts admin write"
on public.blog_posts
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- News items (public read, admin write)
alter table if exists public.news_items enable row level security;
drop policy if exists "news_items public read" on public.news_items;
drop policy if exists "news_items admin write" on public.news_items;
create policy "news_items public read"
on public.news_items
for select
to anon, authenticated
using (true);
create policy "news_items admin write"
on public.news_items
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- 3) user_roles RLS: minimal safe policies.
-- If you're currently getting "infinite recursion detected in policy for relation user_roles",
-- it's usually because the policy uses subqueries against user_roles. Replace them with these.
alter table if exists public.user_roles enable row level security;
drop policy if exists "user_roles self read" on public.user_roles;
drop policy if exists "user_roles admin all" on public.user_roles;
create policy "user_roles self read"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());
create policy "user_roles admin all"
on public.user_roles
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

commit;

-- QUICK CHECKS (run manually):
-- 1) Who is admin right now?
-- select u.id, u.nickname, r.name as role
-- from public.user_roles ur
-- join public.roles r on r.id = ur.role_id
-- join public.users u on u.id = ur.user_id
-- where r.name = 'admin';
--
-- 2) Remove accidental admin role from a user:
-- delete from public.user_roles ur
-- using public.roles r
-- where ur.role_id = r.id and r.name = 'admin' and ur.user_id = 'PUT-USER-UUID-HERE';

