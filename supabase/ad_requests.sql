-- Advertising / sponsorship contact requests
-- Run in Supabase SQL editor.

begin;

create table if not exists public.ad_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  company text,
  website text,
  budget text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_requests_created_at_idx on public.ad_requests(created_at desc);
create index if not exists ad_requests_status_idx on public.ad_requests(status);

alter table public.ad_requests enable row level security;

drop policy if exists "ad_requests public insert" on public.ad_requests;
drop policy if exists "ad_requests admin read" on public.ad_requests;
drop policy if exists "ad_requests admin update" on public.ad_requests;
drop policy if exists "ad_requests admin delete" on public.ad_requests;

create policy "ad_requests public insert"
on public.ad_requests
for insert
to anon, authenticated
with check (true);

create policy "ad_requests admin read"
on public.ad_requests
for select
to authenticated
using (public.is_admin(auth.uid()));

create policy "ad_requests admin update"
on public.ad_requests
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "ad_requests admin delete"
on public.ad_requests
for delete
to authenticated
using (public.is_admin(auth.uid()));

commit;

