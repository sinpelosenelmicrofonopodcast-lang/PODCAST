-- Fix: add updated_at to news_items (required by admin editor)
-- Run in Supabase SQL editor, then reload PostgREST schema cache.

begin;

alter table if exists public.news_items
  add column if not exists updated_at timestamptz;

update public.news_items
set updated_at = coalesce(updated_at, published_at, now());

alter table public.news_items
  alter column updated_at set default now();

commit;

-- Refresh PostgREST schema cache (fixes "schema cache" errors in the API layer).
select pg_notify('pgrst', 'reload schema');

