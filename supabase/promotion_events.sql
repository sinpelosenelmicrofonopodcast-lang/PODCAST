-- Promotions tracking events (CTR, dismisses)
-- Run in Supabase SQL editor.

begin;

create table if not exists public.promotion_events (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  placement text not null,
  event text not null check (event in ('impression','click','dismiss')),
  path text not null,
  session_id text not null,
  created_at timestamptz not null default now()
);

alter table public.promotion_events enable row level security;

drop policy if exists "promotion_events public insert" on public.promotion_events;
create policy "promotion_events public insert"
on public.promotion_events
for insert
to anon, authenticated
with check (true);

drop policy if exists "promotion_events admin read" on public.promotion_events;
create policy "promotion_events admin read"
on public.promotion_events
for select
to authenticated
using (public.is_admin(auth.uid()));

commit;

