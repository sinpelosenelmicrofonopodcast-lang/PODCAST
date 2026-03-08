-- Performance optimization pass (safe indexes only)
-- Date: 2026-03-08
-- Notes:
-- 1) Uses IF NOT EXISTS + to_regclass guards to avoid breaking existing environments.
-- 2) Focused on hot paths observed in homepage, feed, admin, cron, and analytics endpoints.

begin;

-- news_items hot reads: latest published lists and region/category filters.
do $$
declare
  has_publication_state boolean := false;
  has_published_at boolean := false;
  has_region boolean := false;
  has_categories boolean := false;
begin
  if to_regclass('public.news_items') is not null then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'news_items' and column_name = 'publication_state'
    ) into has_publication_state;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'news_items' and column_name = 'published_at'
    ) into has_published_at;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'news_items' and column_name = 'region'
    ) into has_region;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'news_items' and column_name = 'categories'
    ) into has_categories;

    if has_publication_state and has_published_at then
      create index if not exists idx_news_items_state_published_at_desc
        on public.news_items (publication_state, published_at desc);
    elsif has_published_at then
      create index if not exists idx_news_items_published_at_desc
        on public.news_items (published_at desc);
    end if;

    if has_region and has_publication_state and has_published_at then
      create index if not exists idx_news_items_region_state_published_at_desc
        on public.news_items (region, publication_state, published_at desc);
    end if;

    if has_categories then
      create index if not exists idx_news_items_categories_gin
        on public.news_items using gin (categories);
    end if;
  end if;
end $$;

-- blog listing hot reads.
do $$
declare
  has_publication_state boolean := false;
  has_created_at boolean := false;
begin
  if to_regclass('public.blog_posts') is not null then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'blog_posts' and column_name = 'publication_state'
    ) into has_publication_state;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'blog_posts' and column_name = 'created_at'
    ) into has_created_at;

    if has_publication_state and has_created_at then
      create index if not exists idx_blog_posts_state_created_at_desc
        on public.blog_posts (publication_state, created_at desc);
    elsif has_created_at then
      create index if not exists idx_blog_posts_created_at_desc_fallback
        on public.blog_posts (created_at desc);
    end if;
  end if;
end $$;

-- external social feed scans and youtube episode extraction.
do $$
declare
  has_platform boolean := false;
  has_posted_at boolean := false;
begin
  if to_regclass('public.external_posts') is not null then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'external_posts' and column_name = 'platform'
    ) into has_platform;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'external_posts' and column_name = 'posted_at'
    ) into has_posted_at;

    if has_platform and has_posted_at then
      create index if not exists idx_external_posts_platform_posted_at_desc
        on public.external_posts (platform, posted_at desc);
    end if;
    if has_posted_at then
      create index if not exists idx_external_posts_posted_at_desc
        on public.external_posts (posted_at desc);
    end if;
  end if;
end $$;

-- legacy comments lookups by content.
do $$
declare
  has_content_type boolean := false;
  has_content_id boolean := false;
  has_created_at boolean := false;
begin
  if to_regclass('public.comments') is not null then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'comments' and column_name = 'content_type'
    ) into has_content_type;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'comments' and column_name = 'content_id'
    ) into has_content_id;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'comments' and column_name = 'created_at'
    ) into has_created_at;

    if has_content_type and has_content_id then
      create index if not exists idx_comments_content_type_content_id
        on public.comments (content_type, content_id);
    end if;
    if has_content_type and has_created_at then
      create index if not exists idx_comments_content_type_created_at_desc
        on public.comments (content_type, created_at desc);
    end if;
  end if;
end $$;

-- homepage community block (threads by space/time).
do $$
declare
  has_space boolean := false;
  has_created_at boolean := false;
begin
  if to_regclass('public.threads') is not null then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'threads' and column_name = 'space'
    ) into has_space;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'threads' and column_name = 'created_at'
    ) into has_created_at;

    if has_space and has_created_at then
      create index if not exists idx_threads_space_created_at_desc
        on public.threads (space, created_at desc);
    elsif has_created_at then
      create index if not exists idx_threads_created_at_desc_fallback
        on public.threads (created_at desc);
    end if;
  end if;
end $$;

-- promotions window filtering + ordering.
do $$
declare
  has_is_active boolean := false;
  has_starts_at boolean := false;
  has_ends_at boolean := false;
  has_display_order boolean := false;
begin
  if to_regclass('public.promotions') is not null then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'promotions' and column_name = 'is_active'
    ) into has_is_active;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'promotions' and column_name = 'starts_at'
    ) into has_starts_at;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'promotions' and column_name = 'ends_at'
    ) into has_ends_at;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'promotions' and column_name = 'display_order'
    ) into has_display_order;

    if has_is_active and has_starts_at and has_ends_at and has_display_order then
      create index if not exists idx_promotions_active_window_order
        on public.promotions (is_active, starts_at, ends_at, display_order);
    end if;
  end if;
end $$;

-- scheduled posts: stale lock recovery + due queue scans.
do $$
declare
  has_status boolean := false;
  has_updated_at boolean := false;
  has_scheduled_for boolean := false;
begin
  if to_regclass('public.scheduled_posts') is not null then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'status'
    ) into has_status;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'updated_at'
    ) into has_updated_at;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'scheduled_for'
    ) into has_scheduled_for;

    if has_status and has_updated_at then
      create index if not exists idx_scheduled_posts_publishing_updated_at
        on public.scheduled_posts (updated_at)
        where status = 'publishing';
    end if;
    if has_status and has_scheduled_for then
      create index if not exists idx_scheduled_posts_queued_scheduled_for
        on public.scheduled_posts (scheduled_for)
        where status = 'queued';
    end if;
  end if;
end $$;

-- automation job runner queue scans.
do $$
declare
  has_status boolean := false;
  has_priority boolean := false;
  has_scheduled_for boolean := false;
begin
  if to_regclass('public.automation_jobs') is not null then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'automation_jobs' and column_name = 'status'
    ) into has_status;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'automation_jobs' and column_name = 'priority'
    ) into has_priority;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'automation_jobs' and column_name = 'scheduled_for'
    ) into has_scheduled_for;

    if has_status and has_priority and has_scheduled_for then
      create index if not exists idx_automation_jobs_queue_run
        on public.automation_jobs (status, priority, scheduled_for);
    end if;
  end if;
end $$;

-- page visits: noticias prefix scans + recent windows.
do $$
declare
  has_path boolean := false;
  has_visited_at boolean := false;
begin
  if to_regclass('public.page_visits') is not null then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'page_visits' and column_name = 'path'
    ) into has_path;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'page_visits' and column_name = 'visited_at'
    ) into has_visited_at;

    if has_path and has_visited_at then
      create index if not exists idx_page_visits_path_pattern_visited_at_desc
        on public.page_visits (path text_pattern_ops, visited_at desc);
    end if;
  end if;
end $$;

-- viral OS feed and trending routes.
do $$
declare
  has_status boolean := false;
  has_published_at boolean := false;
  has_trending_score boolean := false;
  has_region boolean := false;
begin
  if to_regclass('public.news_articles') is not null then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'news_articles' and column_name = 'status'
    ) into has_status;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'news_articles' and column_name = 'published_at'
    ) into has_published_at;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'news_articles' and column_name = 'trending_score'
    ) into has_trending_score;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'news_articles' and column_name = 'region'
    ) into has_region;

    if has_status and has_published_at then
      create index if not exists idx_news_articles_status_published_at_desc
        on public.news_articles (status, published_at desc);
    end if;
    if has_status and has_trending_score and has_published_at then
      create index if not exists idx_news_articles_status_trending_published_desc
        on public.news_articles (status, trending_score desc, published_at desc);
    end if;
    if has_region and has_status and has_trending_score then
      create index if not exists idx_news_articles_region_status_trending_desc
        on public.news_articles (region, status, trending_score desc);
    end if;
  end if;
end $$;

commit;
