-- Viral Content Operating System (additive, non-breaking)
-- Run in Supabase SQL editor after existing schema files.

begin;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.has_role(uid uuid, allowed text[])
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
      and lower(r.name) = any (
        select lower(x) from unnest(coalesce(allowed, '{}'::text[])) x
      )
  );
$$;

grant execute on function public.has_role(uuid, text[]) to authenticated;

create or replace function public.can_manage_editorial(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(uid, array['owner', 'admin', 'editor', 'moderator']);
$$;

grant execute on function public.can_manage_editorial(uuid) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 1) Extend existing news_sources without breaking previous pipeline
alter table if exists public.news_sources
  add column if not exists type text,
  add column if not exists api_url text,
  add column if not exists category text,
  add column if not exists active boolean,
  add column if not exists priority integer default 0,
  add column if not exists meta jsonb not null default '{}'::jsonb,
  add column if not exists last_checked_at timestamptz;

update public.news_sources
set
  type = coalesce(type, 'rss'),
  active = coalesce(active, is_active, true),
  last_checked_at = coalesce(last_checked_at, last_scanned_at)
where true;

alter table if exists public.news_sources
  alter column type set default 'rss',
  alter column active set default true,
  alter column priority set default 0;

create index if not exists idx_news_sources_active_priority
  on public.news_sources (active, priority desc, updated_at desc);

create index if not exists idx_news_sources_type
  on public.news_sources (type);

create index if not exists idx_news_sources_last_checked
  on public.news_sources (last_checked_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'news_sources_type_check'
      and conrelid = 'public.news_sources'::regclass
  ) then
    alter table public.news_sources
      add constraint news_sources_type_check
      check (type in ('rss', 'api', 'trend', 'manual'));
  end if;
end$$;

-- 2) Main editorial table for viral OS
create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.news_sources(id) on delete set null,
  legacy_news_item_id uuid references public.news_items(id) on delete set null,
  title text not null,
  slug text not null unique,
  source_url text unique,
  original_title text,
  original_content text,
  rewritten_content text,
  summary text,
  excerpt text,
  author_name text,
  category text,
  region text,
  tags text[] not null default '{}'::text[],
  featured_image_url text,
  cover_image_url text,
  meme_image_url text,
  quote_card_url text,
  reel_video_url text,
  reel_script text,
  status text not null default 'draft',
  publish_at timestamptz,
  published_at timestamptz,
  trending_score numeric not null default 0,
  discover_score numeric not null default 0,
  controversy_score numeric not null default 0,
  engagement_score numeric not null default 0,
  ai_metadata jsonb not null default '{}'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  social jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'news_articles_status_check'
      and conrelid = 'public.news_articles'::regclass
  ) then
    alter table public.news_articles
      add constraint news_articles_status_check
      check (status in ('draft', 'pending_review', 'scheduled', 'published', 'rejected', 'archived'));
  end if;
end$$;

drop trigger if exists trg_news_articles_updated_at on public.news_articles;
create trigger trg_news_articles_updated_at
before update on public.news_articles
for each row
execute function public.set_updated_at();

create index if not exists idx_news_articles_slug on public.news_articles(slug);
create index if not exists idx_news_articles_status on public.news_articles(status);
create index if not exists idx_news_articles_published_at on public.news_articles(published_at desc);
create index if not exists idx_news_articles_publish_at on public.news_articles(publish_at asc);
create index if not exists idx_news_articles_category on public.news_articles(category);
create index if not exists idx_news_articles_region on public.news_articles(region);
create index if not exists idx_news_articles_trending_score on public.news_articles(trending_score desc);
create index if not exists idx_news_articles_discover_score on public.news_articles(discover_score desc);

create table if not exists public.news_assets (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.news_articles(id) on delete cascade,
  asset_type text not null,
  url text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'news_assets_type_check'
      and conrelid = 'public.news_assets'::regclass
  ) then
    alter table public.news_assets
      add constraint news_assets_type_check
      check (asset_type in ('cover', 'meme', 'quote_card', 'reel_thumbnail', 'other'));
  end if;
end$$;

create index if not exists idx_news_assets_article on public.news_assets(article_id, created_at desc);

create table if not exists public.trending_metrics (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null unique references public.news_articles(id) on delete cascade,
  views integer not null default 0,
  unique_views integer not null default 0,
  shares integer not null default 0,
  comments integer not null default 0,
  likes integer not null default 0,
  bookmarks integer not null default 0,
  avg_read_time numeric not null default 0,
  scroll_depth numeric not null default 0,
  click_rate numeric not null default 0,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_trending_metrics_updated_at on public.trending_metrics;
create trigger trg_trending_metrics_updated_at
before update on public.trending_metrics
for each row
execute function public.set_updated_at();

create index if not exists idx_trending_metrics_views on public.trending_metrics(views desc, updated_at desc);
create index if not exists idx_trending_metrics_shares on public.trending_metrics(shares desc, updated_at desc);

create table if not exists public.article_events (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.news_articles(id) on delete cascade,
  event_type text not null,
  user_id uuid references public.users(id) on delete set null,
  session_id text,
  referrer text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_article_events_article_time on public.article_events(article_id, created_at desc);
create index if not exists idx_article_events_type_time on public.article_events(event_type, created_at desc);
create index if not exists idx_article_events_session on public.article_events(session_id);

create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.news_articles(id) on delete cascade,
  parent_id uuid references public.article_comments(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  guest_name text,
  body text not null,
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  score integer generated always as (upvotes - downvotes) stored,
  status text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'article_comments_status_check'
      and conrelid = 'public.article_comments'::regclass
  ) then
    alter table public.article_comments
      add constraint article_comments_status_check
      check (status in ('visible', 'hidden', 'flagged', 'pending'));
  end if;
end$$;

drop trigger if exists trg_article_comments_updated_at on public.article_comments;
create trigger trg_article_comments_updated_at
before update on public.article_comments
for each row
execute function public.set_updated_at();

create index if not exists idx_article_comments_article on public.article_comments(article_id, created_at desc);
create index if not exists idx_article_comments_parent on public.article_comments(parent_id, created_at asc);
create index if not exists idx_article_comments_status on public.article_comments(status, created_at desc);

create table if not exists public.article_comment_votes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.article_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  vote smallint not null,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'article_comment_votes_vote_check'
      and conrelid = 'public.article_comment_votes'::regclass
  ) then
    alter table public.article_comment_votes
      add constraint article_comment_votes_vote_check
      check (vote in (-1, 1));
  end if;
end$$;

create index if not exists idx_article_comment_votes_comment on public.article_comment_votes(comment_id);

create table if not exists public.article_polls (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.news_articles(id) on delete cascade,
  question text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_article_polls_article on public.article_polls(article_id, created_at desc);

create table if not exists public.article_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.article_polls(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0
);

create index if not exists idx_article_poll_options_poll on public.article_poll_options(poll_id, sort_order asc);

create table if not exists public.article_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.article_polls(id) on delete cascade,
  option_id uuid not null references public.article_poll_options(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  session_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_article_poll_votes_poll on public.article_poll_votes(poll_id, created_at desc);
create unique index if not exists idx_article_poll_votes_user_unique
  on public.article_poll_votes(poll_id, user_id)
  where user_id is not null;
create unique index if not exists idx_article_poll_votes_session_unique
  on public.article_poll_votes(poll_id, session_id)
  where user_id is null and session_id is not null;

-- Confessions extension (keeps compatibility with existing confessions page)
alter table if exists public.confessions
  add column if not exists title text,
  add column if not exists media_url text,
  add column if not exists is_anonymous boolean not null default true,
  add column if not exists category text,
  add column if not exists region text,
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists approved_by uuid references public.users(id) on delete set null,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_confessions_updated_at on public.confessions;
create trigger trg_confessions_updated_at
before update on public.confessions
for each row
execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'confessions_status_vcos_check'
      and conrelid = 'public.confessions'::regclass
  ) then
    alter table public.confessions
      add constraint confessions_status_vcos_check
      check (status in ('pending', 'approved', 'rejected', 'published'));
  end if;
exception
  when check_violation then
    -- keep backward compatibility if legacy values exist
    null;
end$$;

create index if not exists idx_confessions_status on public.confessions(status, created_at desc);
create index if not exists idx_confessions_category on public.confessions(category);

create table if not exists public.social_publications (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.news_articles(id) on delete cascade,
  platform text not null,
  status text not null default 'queued',
  external_id text,
  payload jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_publications_status_check'
      and conrelid = 'public.social_publications'::regclass
  ) then
    alter table public.social_publications
      add constraint social_publications_status_check
      check (status in ('queued', 'published', 'failed'));
  end if;
end$$;

create index if not exists idx_social_publications_platform_status on public.social_publications(platform, status, created_at desc);
create index if not exists idx_social_publications_article on public.social_publications(article_id, created_at desc);

create table if not exists public.trend_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text,
  keyword text not null,
  region text,
  score numeric not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_trend_snapshots_region_time on public.trend_snapshots(region, created_at desc);
create index if not exists idx_trend_snapshots_keyword on public.trend_snapshots(keyword);

create table if not exists public.user_reputation (
  user_id uuid primary key references public.users(id) on delete cascade,
  points integer not null default 0,
  rank text not null default 'Chismoso',
  comments_count integer not null default 0,
  posts_count integer not null default 0,
  shares_count integer not null default 0,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_reputation_updated_at on public.user_reputation;
create trigger trg_user_reputation_updated_at
before update on public.user_reputation
for each row
execute function public.set_updated_at();

create table if not exists public.admin_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_admin_settings_updated_at on public.admin_settings;
create trigger trg_admin_settings_updated_at
before update on public.admin_settings
for each row
execute function public.set_updated_at();

-- Default settings for viral engine
insert into public.admin_settings (key, value)
values
  ('viral_scoring', '{"sharesWeight":3,"commentsWeight":2,"viewsWeight":0.5,"avgReadWeight":1.2,"clickRateWeight":2,"discoverWeight":1.5,"controversyWeight":1.2}'::jsonb),
  ('editorial_tone', '{"voice":"sin-pelos","regionPriority":["PR","TX","USA","Mundo"],"maxSummaryChars":155}'::jsonb),
  ('automation_intervals', '{"newsIngestMin":10,"trendsMin":30,"publishMin":5,"rescoreMin":15,"resurfacerHours":6,"analyticsHours":1}'::jsonb),
  ('push_thresholds', '{"autoPushEnabled":true,"trendingThreshold":70,"breakingImmediate":true}'::jsonb)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

-- 3) Utility functions for ranking and aggregation
create or replace function public.compute_article_viral_score(
  p_article_id uuid
)
returns numeric
language sql
stable
set search_path = public
as $$
  with m as (
    select * from public.trending_metrics where article_id = p_article_id
  ),
  a as (
    select * from public.news_articles where id = p_article_id
  )
  select coalesce(
    (
      coalesce(m.shares, 0) * 3
      + coalesce(m.comments, 0) * 2
      + coalesce(m.views, 0) * 0.5
      + coalesce(m.avg_read_time, 0) * 1.2
      + coalesce(m.click_rate, 0) * 2
      + coalesce(a.discover_score, 0) * 1.5
      + coalesce(a.controversy_score, 0) * 1.2
    )::numeric,
    0
  )
  from a
  left join m on true;
$$;

create or replace function public.refresh_trending_metrics_from_events(p_window_hours integer default 24)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows integer := 0;
begin
  insert into public.trending_metrics (
    article_id, views, unique_views, shares, comments, likes, bookmarks, avg_read_time, scroll_depth, click_rate, updated_at
  )
  select
    e.article_id,
    count(*) filter (where e.event_type in ('view', 'article_open'))::int as views,
    count(distinct nullif(e.session_id, '')) filter (where e.event_type in ('view', 'article_open'))::int as unique_views,
    count(*) filter (where e.event_type in ('share', 'share_intent'))::int as shares,
    count(*) filter (where e.event_type in ('comment', 'comment_create', 'comment_reply'))::int as comments,
    count(*) filter (where e.event_type in ('like', 'reaction'))::int as likes,
    count(*) filter (where e.event_type in ('bookmark', 'save'))::int as bookmarks,
    avg((e.meta->>'read_time')::numeric) filter (where (e.meta ? 'read_time')) as avg_read_time,
    avg((e.meta->>'scroll_depth')::numeric) filter (where (e.meta ? 'scroll_depth')) as scroll_depth,
    avg((e.meta->>'click_rate')::numeric) filter (where (e.meta ? 'click_rate')) as click_rate,
    now()
  from public.article_events e
  where e.created_at >= now() - make_interval(hours => greatest(1, p_window_hours))
  group by e.article_id
  on conflict (article_id) do update
  set
    views = excluded.views,
    unique_views = excluded.unique_views,
    shares = excluded.shares,
    comments = excluded.comments,
    likes = excluded.likes,
    bookmarks = excluded.bookmarks,
    avg_read_time = coalesce(excluded.avg_read_time, public.trending_metrics.avg_read_time),
    scroll_depth = coalesce(excluded.scroll_depth, public.trending_metrics.scroll_depth),
    click_rate = coalesce(excluded.click_rate, public.trending_metrics.click_rate),
    updated_at = now();

  get diagnostics updated_rows = row_count;

  update public.news_articles a
  set
    engagement_score = public.compute_article_viral_score(a.id),
    trending_score = greatest(public.compute_article_viral_score(a.id), coalesce(a.trending_score, 0)),
    updated_at = now()
  where exists (select 1 from public.trending_metrics tm where tm.article_id = a.id);

  return updated_rows;
end;
$$;

-- 4) Admin view
create or replace view public.admin_viral_kpis as
select
  (select count(*) from public.news_articles) as total_articles,
  (select count(*) from public.news_articles where status = 'published') as published_articles,
  (select count(*) from public.news_articles where status in ('draft', 'pending_review', 'scheduled')) as queued_articles,
  (select count(*) from public.social_publications where status = 'queued') as social_queued,
  (select count(*) from public.social_publications where status = 'failed') as social_failed,
  (select count(*) from public.trend_snapshots where created_at >= now() - interval '24 hours') as trends_24h,
  (select max(created_at) from public.trend_snapshots) as trends_last_at,
  (select max(updated_at) from public.trending_metrics) as metrics_last_at;

-- 5) RLS
alter table public.news_articles enable row level security;
alter table public.news_assets enable row level security;
alter table public.trending_metrics enable row level security;
alter table public.article_events enable row level security;
alter table public.article_comments enable row level security;
alter table public.article_comment_votes enable row level security;
alter table public.article_polls enable row level security;
alter table public.article_poll_options enable row level security;
alter table public.article_poll_votes enable row level security;
alter table public.social_publications enable row level security;
alter table public.trend_snapshots enable row level security;
alter table public.user_reputation enable row level security;
alter table public.admin_settings enable row level security;

-- Public read policies

drop policy if exists "news_articles public read published" on public.news_articles;
create policy "news_articles public read published"
on public.news_articles
for select
to anon, authenticated
using (status = 'published' and coalesce(published_at, now()) <= now());

drop policy if exists "news_assets public read" on public.news_assets;
create policy "news_assets public read"
on public.news_assets
for select
to anon, authenticated
using (
  exists (
    select 1 from public.news_articles a
    where a.id = article_id
      and a.status = 'published'
      and coalesce(a.published_at, now()) <= now()
  )
);

drop policy if exists "trending_metrics public read" on public.trending_metrics;
create policy "trending_metrics public read"
on public.trending_metrics
for select
to anon, authenticated
using (
  exists (
    select 1 from public.news_articles a
    where a.id = article_id
      and a.status = 'published'
      and coalesce(a.published_at, now()) <= now()
  )
);

drop policy if exists "article_comments public read visible" on public.article_comments;
create policy "article_comments public read visible"
on public.article_comments
for select
to anon, authenticated
using (
  status = 'visible'
  and exists (
    select 1 from public.news_articles a
    where a.id = article_id
      and a.status = 'published'
      and coalesce(a.published_at, now()) <= now()
  )
);

drop policy if exists "article_polls public read active" on public.article_polls;
create policy "article_polls public read active"
on public.article_polls
for select
to anon, authenticated
using (
  active = true
  and exists (
    select 1 from public.news_articles a
    where a.id = article_id
      and a.status = 'published'
      and coalesce(a.published_at, now()) <= now()
  )
);

drop policy if exists "article_poll_options public read" on public.article_poll_options;
create policy "article_poll_options public read"
on public.article_poll_options
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.article_polls p
    join public.news_articles a on a.id = p.article_id
    where p.id = poll_id
      and p.active = true
      and a.status = 'published'
  )
);

drop policy if exists "trend_snapshots public read" on public.trend_snapshots;
create policy "trend_snapshots public read"
on public.trend_snapshots
for select
to anon, authenticated
using (true);

drop policy if exists "user_reputation public read" on public.user_reputation;
create policy "user_reputation public read"
on public.user_reputation
for select
to anon, authenticated
using (true);

-- Authenticated inserts for comments and poll votes

drop policy if exists "article_comments auth create" on public.article_comments;
create policy "article_comments auth create"
on public.article_comments
for insert
to anon, authenticated
with check (
  status in ('visible', 'pending')
  and char_length(body) between 2 and 2000
  and (
    user_id is null
    or user_id = auth.uid()
  )
);

drop policy if exists "article_comment_votes auth manage" on public.article_comment_votes;
create policy "article_comment_votes auth manage"
on public.article_comment_votes
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "article_poll_votes auth insert" on public.article_poll_votes;
create policy "article_poll_votes auth insert"
on public.article_poll_votes
for insert
to anon, authenticated
with check (
  user_id is null or user_id = auth.uid()
);

-- Editorial/admin policies

drop policy if exists "news_articles editorial all" on public.news_articles;
create policy "news_articles editorial all"
on public.news_articles
for all
to authenticated
using (public.can_manage_editorial(auth.uid()))
with check (public.can_manage_editorial(auth.uid()));

drop policy if exists "news_assets editorial all" on public.news_assets;
create policy "news_assets editorial all"
on public.news_assets
for all
to authenticated
using (public.can_manage_editorial(auth.uid()))
with check (public.can_manage_editorial(auth.uid()));

drop policy if exists "trending_metrics editorial all" on public.trending_metrics;
create policy "trending_metrics editorial all"
on public.trending_metrics
for all
to authenticated
using (public.can_manage_editorial(auth.uid()))
with check (public.can_manage_editorial(auth.uid()));

drop policy if exists "article_events editorial all" on public.article_events;
create policy "article_events editorial all"
on public.article_events
for all
to authenticated
using (public.can_manage_editorial(auth.uid()))
with check (public.can_manage_editorial(auth.uid()));

drop policy if exists "article_comments editorial moderate" on public.article_comments;
create policy "article_comments editorial moderate"
on public.article_comments
for all
to authenticated
using (public.can_manage_editorial(auth.uid()))
with check (public.can_manage_editorial(auth.uid()));

drop policy if exists "article_polls editorial all" on public.article_polls;
create policy "article_polls editorial all"
on public.article_polls
for all
to authenticated
using (public.can_manage_editorial(auth.uid()))
with check (public.can_manage_editorial(auth.uid()));

drop policy if exists "article_poll_options editorial all" on public.article_poll_options;
create policy "article_poll_options editorial all"
on public.article_poll_options
for all
to authenticated
using (public.can_manage_editorial(auth.uid()))
with check (public.can_manage_editorial(auth.uid()));

drop policy if exists "social_publications editorial all" on public.social_publications;
create policy "social_publications editorial all"
on public.social_publications
for all
to authenticated
using (public.can_manage_editorial(auth.uid()))
with check (public.can_manage_editorial(auth.uid()));

drop policy if exists "trend_snapshots editorial all" on public.trend_snapshots;
create policy "trend_snapshots editorial all"
on public.trend_snapshots
for all
to authenticated
using (public.can_manage_editorial(auth.uid()))
with check (public.can_manage_editorial(auth.uid()));

drop policy if exists "admin_settings editorial all" on public.admin_settings;
create policy "admin_settings editorial all"
on public.admin_settings
for all
to authenticated
using (public.can_manage_editorial(auth.uid()))
with check (public.can_manage_editorial(auth.uid()));

drop policy if exists "user_reputation editorial all" on public.user_reputation;
create policy "user_reputation editorial all"
on public.user_reputation
for all
to authenticated
using (public.can_manage_editorial(auth.uid()))
with check (public.can_manage_editorial(auth.uid()));

commit;

select pg_notify('pgrst', 'reload schema');
