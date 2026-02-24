-- News AI rewrite pipeline fields
-- Run this in Supabase SQL Editor.

begin;

alter table if exists public.news_items add column if not exists raw_title text;
alter table if exists public.news_items add column if not exists raw_summary text;
alter table if exists public.news_items add column if not exists raw_body text;
alter table if exists public.news_items add column if not exists raw_payload jsonb not null default '{}'::jsonb;
alter table if exists public.news_items add column if not exists rewrite_status text;
alter table if exists public.news_items add column if not exists rewrite_error text;
alter table if exists public.news_items add column if not exists rewritten_at timestamptz;
alter table if exists public.news_items add column if not exists ai_model text;
alter table if exists public.news_items add column if not exists ai_provider text;
alter table if exists public.news_items add column if not exists needs_review boolean not null default false;

update public.news_items
set
  raw_title = coalesce(raw_title, title),
  raw_summary = coalesce(raw_summary, summary),
  raw_body = coalesce(raw_body, summary),
  rewrite_status = coalesce(rewrite_status, 'done')
where true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'news_items_rewrite_status_check'
      and conrelid = 'public.news_items'::regclass
  ) then
    alter table public.news_items
      add constraint news_items_rewrite_status_check
      check (rewrite_status in ('none', 'queued', 'processing', 'done', 'failed'));
  end if;
end$$;

alter table public.news_items alter column rewrite_status set default 'none';

create index if not exists news_items_rewrite_status_idx
  on public.news_items (rewrite_status, updated_at desc);

commit;

notify pgrst, 'reload schema';
