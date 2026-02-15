-- Add optional episode link fields to blog posts (when an article is about a podcast episode)
-- Safe to run multiple times.

begin;

alter table if exists public.blog_posts
  add column if not exists episode_url text,
  add column if not exists episode_title text;

commit;

-- Refresh PostgREST schema cache (fixes "schema cache" errors in the API layer).
select pg_notify('pgrst', 'reload schema');

