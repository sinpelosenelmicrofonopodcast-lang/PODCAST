-- P0 seguridad fuerte (server + RLS)
-- Ejecutar en Supabase SQL Editor.

begin;

-- =========================
-- Helper functions (no recursion)
-- =========================
create or replace function public.has_role(uid uuid, role_name text)
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
      and r.name = role_name
  );
$$;

create or replace function public.is_admin(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(p_uid, 'admin');
$$;

grant execute on function public.has_role(uuid, text) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;

-- =========================
-- roles / user_roles hardening
-- =========================
alter table if exists public.roles enable row level security;
alter table if exists public.user_roles enable row level security;

drop policy if exists "roles public read" on public.roles;
drop policy if exists "roles read" on public.roles;
drop policy if exists "roles admin write" on public.roles;
create policy "roles public read"
on public.roles
for select
to anon, authenticated
using (true);
create policy "roles admin write"
on public.roles
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "user roles self read" on public.user_roles;
drop policy if exists "user_roles self read" on public.user_roles;
drop policy if exists "user roles admin all" on public.user_roles;
drop policy if exists "user_roles admin all" on public.user_roles;
drop policy if exists "user_roles admin write" on public.user_roles;
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

-- =========================
-- User private data
-- =========================
alter table if exists public.user_private_profiles enable row level security;
drop policy if exists "private profile self read" on public.user_private_profiles;
drop policy if exists "private profile self update" on public.user_private_profiles;
drop policy if exists "private profile self insert" on public.user_private_profiles;
drop policy if exists "private profile admin read" on public.user_private_profiles;
drop policy if exists "private profile admin write" on public.user_private_profiles;
create policy "private profile self read"
on public.user_private_profiles
for select
to authenticated
using (user_id = auth.uid());
create policy "private profile self insert"
on public.user_private_profiles
for insert
to authenticated
with check (user_id = auth.uid());
create policy "private profile self update"
on public.user_private_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy "private profile admin all"
on public.user_private_profiles
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- =========================
-- Admin managed content
-- =========================
alter table if exists public.home_settings enable row level security;
drop policy if exists "home settings public read" on public.home_settings;
drop policy if exists "home_settings public read" on public.home_settings;
drop policy if exists "home settings admin all" on public.home_settings;
drop policy if exists "home_settings admin write" on public.home_settings;
create policy "home_settings public read"
on public.home_settings
for select
to anon, authenticated
using (true);
create policy "home_settings admin all"
on public.home_settings
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

alter table if exists public.promotions enable row level security;
drop policy if exists "promotions public read active" on public.promotions;
drop policy if exists "promotions public read" on public.promotions;
drop policy if exists "promotions admin all" on public.promotions;
drop policy if exists "promotions admin write" on public.promotions;
create policy "promotions public read active"
on public.promotions
for select
to anon, authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);
create policy "promotions admin all"
on public.promotions
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

alter table if exists public.live_events enable row level security;
drop policy if exists "live_events public read" on public.live_events;
drop policy if exists "live_events auth read" on public.live_events;
drop policy if exists "live events public read" on public.live_events;
drop policy if exists "live events auth read" on public.live_events;
drop policy if exists "live events admin all" on public.live_events;
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
create policy "live_events admin all"
on public.live_events
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

alter table if exists public.news_items enable row level security;
drop policy if exists "news public read" on public.news_items;
drop policy if exists "news_items public read" on public.news_items;
drop policy if exists "news_items admin write" on public.news_items;
create policy "news_items public read"
on public.news_items
for select
to anon, authenticated
using (true);
create policy "news_items admin all"
on public.news_items
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

alter table if exists public.blog_posts enable row level security;
drop policy if exists "blog_posts public read" on public.blog_posts;
drop policy if exists "blog_posts admin write" on public.blog_posts;
create policy "blog_posts public read"
on public.blog_posts
for select
to anon, authenticated
using (true);
create policy "blog_posts admin all"
on public.blog_posts
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

alter table if exists public.guest_requests enable row level security;
drop policy if exists "guest_requests public insert" on public.guest_requests;
drop policy if exists "guest requests public insert" on public.guest_requests;
drop policy if exists "guest_requests admin read" on public.guest_requests;
drop policy if exists "guest requests admin read" on public.guest_requests;
drop policy if exists "guest_requests admin update" on public.guest_requests;
drop policy if exists "guest requests admin update" on public.guest_requests;
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

-- =========================
-- Telemetry / newsletter
-- =========================
alter table if exists public.page_visits enable row level security;
drop policy if exists "page visits public insert" on public.page_visits;
drop policy if exists "page_visits public insert" on public.page_visits;
drop policy if exists "page visits admin read" on public.page_visits;
drop policy if exists "page_visits admin read" on public.page_visits;
create policy "page_visits public insert"
on public.page_visits
for insert
to anon, authenticated
with check (true);
create policy "page_visits admin read"
on public.page_visits
for select
to authenticated
using (public.is_admin(auth.uid()));

alter table if exists public.promotion_events enable row level security;
drop policy if exists "promotion_events public insert" on public.promotion_events;
drop policy if exists "promotion_events admin read" on public.promotion_events;
create policy "promotion_events public insert"
on public.promotion_events
for insert
to anon, authenticated
with check (true);
create policy "promotion_events admin read"
on public.promotion_events
for select
to authenticated
using (public.is_admin(auth.uid()));

alter table if exists public.newsletter_subscribers enable row level security;
drop policy if exists "newsletter public upsert" on public.newsletter_subscribers;
drop policy if exists "newsletter public insert" on public.newsletter_subscribers;
drop policy if exists "newsletter admin read" on public.newsletter_subscribers;
drop policy if exists "newsletter admin write" on public.newsletter_subscribers;
create policy "newsletter public insert"
on public.newsletter_subscribers
for insert
to anon, authenticated
with check (true);
create policy "newsletter admin read"
on public.newsletter_subscribers
for select
to authenticated
using (public.is_admin(auth.uid()));
create policy "newsletter admin write"
on public.newsletter_subscribers
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
create policy "newsletter admin delete"
on public.newsletter_subscribers
for delete
to authenticated
using (public.is_admin(auth.uid()));

commit;
