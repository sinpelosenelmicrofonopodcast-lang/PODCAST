-- SEO Autopilot schema (additive, non-breaking)
create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_admin'
  ) then
    create function public.is_admin(user_id uuid)
    returns boolean
    language sql
    stable
    as $f$
      select false
    $f$;
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,
  content_md text,
  cover_image_url text,
  category text,
  tags text[] not null default '{}',
  author_name text default 'SPM News',
  source_name text,
  source_url text,
  canonical_url text,
  region text,
  is_published boolean not null default false,
  is_news boolean not null default true,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  youtube_url text,
  audio_url text,
  thumbnail_url text,
  duration_seconds int,
  is_published boolean not null default false,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  youtube_url text,
  thumbnail_url text,
  is_published boolean not null default false,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  start_datetime timestamptz not null,
  end_datetime timestamptz,
  location_name text,
  address text,
  city text,
  state text,
  flyer_image_url text,
  external_url text,
  organizer_name text,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_queue (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  type text not null check (type in ('post', 'episode', 'clip', 'event', 'page')),
  status text not null default 'pending' check (status in ('pending', 'submitted', 'error', 'skipped')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_audit (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  issue_type text not null check (
    issue_type in (
      'missing_title',
      'missing_description',
      'missing_og',
      'missing_schema',
      'broken_canonical',
      'soft_404',
      'blocked_by_robots',
      'accidental_noindex'
    )
  ),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_posts_slug on public.posts (slug);
create index if not exists idx_episodes_slug on public.episodes (slug);
create index if not exists idx_events_slug on public.events (slug);
create index if not exists idx_seo_queue_status on public.seo_queue (status);
create unique index if not exists idx_seo_queue_url_unique on public.seo_queue (url);

create or replace function public.enqueue_seo_url_from_publish()
returns trigger
language plpgsql
as $$
declare
  canonical_base text := 'https://www.sinpelosenelmicrofono.com';
  canonical_path text := null;
  canonical_type text := null;
begin
  if tg_table_name = 'posts' then
    canonical_path := '/noticias/' || new.slug;
    canonical_type := 'post';
  elsif tg_table_name = 'episodes' then
    canonical_path := '/podcast/' || new.slug;
    canonical_type := 'episode';
  elsif tg_table_name = 'events' then
    canonical_path := '/eventos/' || new.slug;
    canonical_type := 'event';
  end if;

  if canonical_path is null or canonical_type is null then
    return new;
  end if;

  insert into public.seo_queue (url, type, status, attempts, last_error)
  values (canonical_base || canonical_path, canonical_type, 'pending', 0, null)
  on conflict (url)
  do update set
    type = excluded.type,
    status = 'pending',
    last_error = null,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

drop trigger if exists trg_episodes_updated_at on public.episodes;
create trigger trg_episodes_updated_at
before update on public.episodes
for each row execute function public.set_updated_at();

drop trigger if exists trg_clips_updated_at on public.clips;
create trigger trg_clips_updated_at
before update on public.clips
for each row execute function public.set_updated_at();

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists trg_seo_queue_updated_at on public.seo_queue;
create trigger trg_seo_queue_updated_at
before update on public.seo_queue
for each row execute function public.set_updated_at();

drop trigger if exists trg_posts_enqueue_seo_insert on public.posts;
create trigger trg_posts_enqueue_seo_insert
after insert on public.posts
for each row
when (new.is_published = true)
execute function public.enqueue_seo_url_from_publish();

drop trigger if exists trg_posts_enqueue_seo_update on public.posts;
create trigger trg_posts_enqueue_seo_update
after update of is_published, slug on public.posts
for each row
when (new.is_published = true and (old.is_published is distinct from new.is_published or old.slug is distinct from new.slug))
execute function public.enqueue_seo_url_from_publish();

drop trigger if exists trg_episodes_enqueue_seo_insert on public.episodes;
create trigger trg_episodes_enqueue_seo_insert
after insert on public.episodes
for each row
when (new.is_published = true)
execute function public.enqueue_seo_url_from_publish();

drop trigger if exists trg_episodes_enqueue_seo_update on public.episodes;
create trigger trg_episodes_enqueue_seo_update
after update of is_published, slug on public.episodes
for each row
when (new.is_published = true and (old.is_published is distinct from new.is_published or old.slug is distinct from new.slug))
execute function public.enqueue_seo_url_from_publish();

drop trigger if exists trg_events_enqueue_seo_insert on public.events;
create trigger trg_events_enqueue_seo_insert
after insert on public.events
for each row
when (new.is_published = true)
execute function public.enqueue_seo_url_from_publish();

drop trigger if exists trg_events_enqueue_seo_update on public.events;
create trigger trg_events_enqueue_seo_update
after update of is_published, slug on public.events
for each row
when (new.is_published = true and (old.is_published is distinct from new.is_published or old.slug is distinct from new.slug))
execute function public.enqueue_seo_url_from_publish();

alter table if exists public.posts enable row level security;
alter table if exists public.episodes enable row level security;
alter table if exists public.clips enable row level security;
alter table if exists public.events enable row level security;
alter table if exists public.seo_queue enable row level security;
alter table if exists public.seo_audit enable row level security;

drop policy if exists "posts public published read" on public.posts;
create policy "posts public published read" on public.posts
for select
using (is_published = true);

drop policy if exists "episodes public published read" on public.episodes;
create policy "episodes public published read" on public.episodes
for select
using (is_published = true);

drop policy if exists "clips public published read" on public.clips;
create policy "clips public published read" on public.clips
for select
using (is_published = true);

drop policy if exists "events public published read" on public.events;
create policy "events public published read" on public.events
for select
using (is_published = true);

drop policy if exists "posts admin all" on public.posts;
create policy "posts admin all" on public.posts
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "episodes admin all" on public.episodes;
create policy "episodes admin all" on public.episodes
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "clips admin all" on public.clips;
create policy "clips admin all" on public.clips
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "events admin all" on public.events;
create policy "events admin all" on public.events
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "seo_queue admin only" on public.seo_queue;
create policy "seo_queue admin only" on public.seo_queue
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "seo_audit admin only" on public.seo_audit;
create policy "seo_audit admin only" on public.seo_audit
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
