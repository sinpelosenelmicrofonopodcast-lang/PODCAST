-- Performance optimization pass (safe indexes only)
-- Date: 2026-03-08
-- Notes:
-- 1) Uses IF NOT EXISTS + to_regclass guards to avoid breaking existing environments.
-- 2) Focused on hot paths observed in homepage, feed, admin, cron, and analytics endpoints.

begin;

-- news_items hot reads: latest published lists and region/category filters.
do $$
begin
  if to_regclass('public.news_items') is not null then
    create index if not exists idx_news_items_state_published_at_desc
      on public.news_items (publication_state, published_at desc);
    create index if not exists idx_news_items_region_state_published_at_desc
      on public.news_items (region, publication_state, published_at desc);
    create index if not exists idx_news_items_categories_gin
      on public.news_items using gin (categories);
  end if;
end $$;

-- blog listing hot reads.
do $$
begin
  if to_regclass('public.blog_posts') is not null then
    create index if not exists idx_blog_posts_state_created_at_desc
      on public.blog_posts (publication_state, created_at desc);
  end if;
end $$;

-- external social feed scans and youtube episode extraction.
do $$
begin
  if to_regclass('public.external_posts') is not null then
    create index if not exists idx_external_posts_platform_posted_at_desc
      on public.external_posts (platform, posted_at desc);
    create index if not exists idx_external_posts_posted_at_desc
      on public.external_posts (posted_at desc);
  end if;
end $$;

-- legacy comments lookups by content.
do $$
begin
  if to_regclass('public.comments') is not null then
    create index if not exists idx_comments_content_type_content_id
      on public.comments (content_type, content_id);
    create index if not exists idx_comments_content_type_created_at_desc
      on public.comments (content_type, created_at desc);
  end if;
end $$;

-- homepage community block (threads by space/time).
do $$
begin
  if to_regclass('public.threads') is not null then
    create index if not exists idx_threads_space_created_at_desc
      on public.threads (space, created_at desc);
  end if;
end $$;

-- promotions window filtering + ordering.
do $$
begin
  if to_regclass('public.promotions') is not null then
    create index if not exists idx_promotions_active_window_order
      on public.promotions (is_active, starts_at, ends_at, display_order);
  end if;
end $$;

-- scheduled posts: stale lock recovery + due queue scans.
do $$
begin
  if to_regclass('public.scheduled_posts') is not null then
    create index if not exists idx_scheduled_posts_publishing_updated_at
      on public.scheduled_posts (updated_at)
      where status = 'publishing';
    create index if not exists idx_scheduled_posts_queued_scheduled_for
      on public.scheduled_posts (scheduled_for)
      where status = 'queued';
  end if;
end $$;

-- automation job runner queue scans.
do $$
begin
  if to_regclass('public.automation_jobs') is not null then
    create index if not exists idx_automation_jobs_queue_run
      on public.automation_jobs (status, priority, scheduled_for);
  end if;
end $$;

-- page visits: noticias prefix scans + recent windows.
do $$
begin
  if to_regclass('public.page_visits') is not null then
    create index if not exists idx_page_visits_path_pattern_visited_at_desc
      on public.page_visits (path text_pattern_ops, visited_at desc);
  end if;
end $$;

-- viral OS feed and trending routes.
do $$
begin
  if to_regclass('public.news_articles') is not null then
    create index if not exists idx_news_articles_status_published_at_desc
      on public.news_articles (status, published_at desc);
    create index if not exists idx_news_articles_status_trending_published_desc
      on public.news_articles (status, trending_score desc, published_at desc);
    create index if not exists idx_news_articles_region_status_trending_desc
      on public.news_articles (region, status, trending_score desc);
  end if;
end $$;

commit;
