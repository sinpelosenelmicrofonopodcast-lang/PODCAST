-- Blog SEO content model (slug, meta description, read time, categories/tags)

alter table if exists public.blog_posts
  add column if not exists slug text;

alter table if exists public.blog_posts
  add column if not exists meta_description text;

alter table if exists public.blog_posts
  add column if not exists reading_time_minutes integer;

alter table if exists public.blog_posts
  add column if not exists categories text[];

alter table if exists public.blog_posts
  add column if not exists tags text[];

alter table if exists public.blog_posts
  add column if not exists updated_at timestamptz not null default now();

-- Backfill safe defaults so routes work immediately.
do $$
begin
  if to_regclass('public.blog_posts') is not null then
    update public.blog_posts
    set slug = coalesce(slug, id::text)
    where slug is null or btrim(slug) = '';
  end if;
end$$;

-- Basic meta description fallback: prefer meta_description, else excerpt.
do $$
begin
  if to_regclass('public.blog_posts') is not null then
    update public.blog_posts
    set meta_description = coalesce(meta_description, excerpt)
    where meta_description is null;
  end if;
end$$;

-- Unique slug (allow existing duplicates to fail fast so we can fix content).
do $$
begin
  if to_regclass('public.blog_posts') is null then
    return;
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'blog_posts_slug_unique'
  ) then
    alter table public.blog_posts
      add constraint blog_posts_slug_unique unique (slug);
  end if;
end$$;

do $$
begin
  if to_regclass('public.blog_posts') is not null then
    create index if not exists blog_posts_created_at_idx on public.blog_posts(created_at desc);
  end if;
end$$;

-- PostgREST schema cache refresh (Supabase)
notify pgrst, 'reload schema';
