-- P0: dedupe + real jobs queue + observability + admin-only RLS
-- Run this in Supabase SQL Editor.

begin;

create extension if not exists pgcrypto with schema extensions;

-- Keep compatibility with projects where is_admin(uuid) is not present yet.
do $$
begin
  if to_regprocedure('public.is_admin(uuid)') is null then
    execute $fn$
      create function public.is_admin(uid uuid)
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = uid
            and r.name = 'admin'
        );
      $body$;
    $fn$;
    grant execute on function public.is_admin(uuid) to authenticated;
  end if;
end$$;

create or replace function public.normalize_source_url(p text)
returns text
language sql
immutable
as $$
  select nullif(lower(btrim(coalesce(p, ''))), '');
$$;

create or replace function public.compute_news_hash(
  p_title text,
  p_summary text,
  p_analysis text,
  p_source_url text
)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(
      coalesce(public.normalize_source_url(p_source_url), '') || '|' ||
      coalesce(p_title, '') || '|' ||
      coalesce(p_summary, '') || '|' ||
      coalesce(p_analysis, ''),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.compute_blog_hash(
  p_title text,
  p_excerpt text,
  p_body text,
  p_source_url text
)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(
      coalesce(public.normalize_source_url(p_source_url), '') || '|' ||
      coalesce(p_title, '') || '|' ||
      coalesce(p_excerpt, '') || '|' ||
      coalesce(p_body, ''),
      'sha256'
    ),
    'hex'
  );
$$;

-- 1) Content model hardening (news/blog)
alter table if exists public.news_items add column if not exists updated_at timestamptz;
alter table if exists public.news_items add column if not exists content_hash text;
alter table if exists public.news_items add column if not exists publication_state text;
alter table if exists public.news_items add column if not exists ingest_source text;

alter table if exists public.blog_posts add column if not exists source_url text;
alter table if exists public.blog_posts add column if not exists content_hash text;
alter table if exists public.blog_posts add column if not exists publication_state text;
alter table if exists public.blog_posts add column if not exists ingest_source text;
alter table if exists public.blog_posts add column if not exists updated_at timestamptz not null default now();

update public.news_items
set updated_at = coalesce(updated_at, published_at, now())
where updated_at is null;

update public.news_items
set publication_state = coalesce(publication_state, 'published')
where publication_state is null;

update public.blog_posts
set publication_state = coalesce(publication_state, 'published')
where publication_state is null;

alter table public.news_items alter column updated_at set default now();
alter table public.news_items alter column publication_state set default 'published';
alter table public.blog_posts alter column publication_state set default 'published';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'news_items_publication_state_check'
      and conrelid = 'public.news_items'::regclass
  ) then
    alter table public.news_items
      add constraint news_items_publication_state_check
      check (publication_state in ('draft', 'published'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'blog_posts_publication_state_check'
      and conrelid = 'public.blog_posts'::regclass
  ) then
    alter table public.blog_posts
      add constraint blog_posts_publication_state_check
      check (publication_state in ('draft', 'published'));
  end if;
end$$;

create or replace function public.news_items_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.source_url := public.normalize_source_url(new.source_url);
  new.content_hash := public.compute_news_hash(new.title, new.summary, new.analysis, new.source_url);
  new.updated_at := now();
  if new.publication_state is null then
    new.publication_state := 'published';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_news_items_before_write on public.news_items;
create trigger trg_news_items_before_write
before insert or update of title, summary, analysis, source_url, publication_state, published_at
on public.news_items
for each row
execute function public.news_items_before_write();

create or replace function public.blog_posts_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.source_url := public.normalize_source_url(new.source_url);
  new.content_hash := public.compute_blog_hash(new.title, new.excerpt, new.body, new.source_url);
  new.updated_at := now();
  if new.publication_state is null then
    new.publication_state := 'published';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_blog_posts_before_write on public.blog_posts;
create trigger trg_blog_posts_before_write
before insert or update of title, excerpt, body, source_url, publication_state
on public.blog_posts
for each row
execute function public.blog_posts_before_write();

-- Backfill missing hashes now that functions/triggers exist.
update public.news_items
set source_url = public.normalize_source_url(source_url),
    content_hash = public.compute_news_hash(title, summary, analysis, source_url),
    updated_at = coalesce(updated_at, published_at, now())
where content_hash is null
   or btrim(content_hash) = ''
   or source_url is distinct from public.normalize_source_url(source_url);

update public.blog_posts
set source_url = public.normalize_source_url(source_url),
    content_hash = public.compute_blog_hash(title, excerpt, body, source_url),
    updated_at = coalesce(updated_at, now())
where content_hash is null
   or btrim(content_hash) = ''
   or source_url is distinct from public.normalize_source_url(source_url);

-- If there are historical duplicates, keep rows but disambiguate hashes so new unique index can be applied.
with ranked as (
  select
    id,
    row_number() over (
      partition by coalesce(public.normalize_source_url(source_url), ''), coalesce(content_hash, '')
      order by coalesce(updated_at, published_at, now()) desc, id
    ) as rn
  from public.news_items
  where coalesce(public.normalize_source_url(source_url), '') <> ''
     or coalesce(content_hash, '') <> ''
)
update public.news_items n
set content_hash = coalesce(n.content_hash, '') || '-dup-' || left(n.id::text, 8)
from ranked r
where n.id = r.id
  and r.rn > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by coalesce(public.normalize_source_url(source_url), ''), coalesce(content_hash, '')
      order by coalesce(updated_at, created_at, now()) desc, id
    ) as rn
  from public.blog_posts
  where coalesce(public.normalize_source_url(source_url), '') <> ''
     or coalesce(content_hash, '') <> ''
)
update public.blog_posts b
set content_hash = coalesce(b.content_hash, '') || '-dup-' || left(b.id::text, 8)
from ranked r
where b.id = r.id
  and r.rn > 1;

create unique index if not exists news_items_source_hash_unique
  on public.news_items (
    coalesce(public.normalize_source_url(source_url), '~'),
    coalesce(content_hash, '~')
  );

create unique index if not exists blog_posts_source_hash_unique
  on public.blog_posts (
    coalesce(public.normalize_source_url(source_url), '~'),
    coalesce(content_hash, '~')
  );

with ranked as (
  select
    id,
    row_number() over (
      partition by lower(coalesce(platform, '')), lower(coalesce(external_id, ''))
      order by coalesce(posted_at, now()) desc, id
    ) as rn
  from public.external_posts
)
delete from public.external_posts ep
using ranked r
where ep.id = r.id
  and r.rn > 1;

create unique index if not exists external_posts_platform_external_id_unique
  on public.external_posts (platform, external_id);

-- 2) Real queue + observability
create table if not exists public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  source text,
  title text,
  content_type text,
  content_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  priority integer not null default 50,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  error text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'automation_jobs_status_check'
      and conrelid = 'public.automation_jobs'::regclass
  ) then
    alter table public.automation_jobs
      add constraint automation_jobs_status_check
      check (status in ('queued', 'running', 'done', 'failed', 'cancelled'));
  end if;
end$$;

create index if not exists automation_jobs_status_sched_idx on public.automation_jobs(status, scheduled_for asc);
create index if not exists automation_jobs_created_idx on public.automation_jobs(created_at desc);
create index if not exists automation_jobs_content_idx on public.automation_jobs(content_type, content_id);

create table if not exists public.pipeline_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.automation_jobs(id) on delete set null,
  stage text not null,
  status text not null default 'info',
  content_type text,
  content_id text,
  platform text,
  message text,
  meta jsonb not null default '{}'::jsonb,
  actor_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pipeline_events_stage_check'
      and conrelid = 'public.pipeline_events'::regclass
  ) then
    alter table public.pipeline_events
      add constraint pipeline_events_stage_check
      check (stage in ('ingested', 'draft', 'published', 'social', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pipeline_events_status_check'
      and conrelid = 'public.pipeline_events'::regclass
  ) then
    alter table public.pipeline_events
      add constraint pipeline_events_status_check
      check (status in ('info', 'ok', 'error'));
  end if;
end$$;

create index if not exists pipeline_events_created_idx on public.pipeline_events(created_at desc);
create index if not exists pipeline_events_stage_status_idx on public.pipeline_events(stage, status, created_at desc);
create index if not exists pipeline_events_job_idx on public.pipeline_events(job_id, created_at desc);

create or replace function public.automation_jobs_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_automation_jobs_before_update on public.automation_jobs;
create trigger trg_automation_jobs_before_update
before update on public.automation_jobs
for each row
execute function public.automation_jobs_before_update();

-- Auto observability events for manual/admin edits.
create or replace function public.news_items_pipeline_event_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  stage_name text;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.source_url, '') <> '' then
      insert into public.pipeline_events (stage, status, content_type, content_id, message, meta, actor_id)
      values (
        'ingested',
        'ok',
        'news',
        new.id::text,
        'Noticia ingerida',
        jsonb_build_object('source_url', new.source_url, 'ingest_source', new.ingest_source),
        auth.uid()
      );
    end if;

    stage_name := case when new.publication_state = 'draft' then 'draft' else 'published' end;
    insert into public.pipeline_events (stage, status, content_type, content_id, message, actor_id)
    values (stage_name, 'ok', 'news', new.id::text, 'Noticia guardada', auth.uid());
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.publication_state is distinct from old.publication_state then
      stage_name := case when new.publication_state = 'draft' then 'draft' else 'published' end;
      insert into public.pipeline_events (stage, status, content_type, content_id, message, actor_id)
      values (stage_name, 'ok', 'news', new.id::text, 'Estado de publicación actualizado', auth.uid());
    elsif new.content_hash is distinct from old.content_hash then
      stage_name := case when new.publication_state = 'draft' then 'draft' else 'published' end;
      insert into public.pipeline_events (stage, status, content_type, content_id, message, actor_id)
      values (stage_name, 'info', 'news', new.id::text, 'Noticia actualizada', auth.uid());
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_news_items_pipeline_event on public.news_items;
create trigger trg_news_items_pipeline_event
after insert or update on public.news_items
for each row
execute function public.news_items_pipeline_event_trigger();

create or replace function public.blog_posts_pipeline_event_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  stage_name text;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.source_url, '') <> '' then
      insert into public.pipeline_events (stage, status, content_type, content_id, message, meta, actor_id)
      values (
        'ingested',
        'ok',
        'blog',
        new.id::text,
        'Blog ingerido',
        jsonb_build_object('source_url', new.source_url, 'ingest_source', new.ingest_source),
        auth.uid()
      );
    end if;

    stage_name := case when new.publication_state = 'draft' then 'draft' else 'published' end;
    insert into public.pipeline_events (stage, status, content_type, content_id, message, actor_id)
    values (stage_name, 'ok', 'blog', new.id::text, 'Blog guardado', auth.uid());
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.publication_state is distinct from old.publication_state then
      stage_name := case when new.publication_state = 'draft' then 'draft' else 'published' end;
      insert into public.pipeline_events (stage, status, content_type, content_id, message, actor_id)
      values (stage_name, 'ok', 'blog', new.id::text, 'Estado de publicación actualizado', auth.uid());
    elsif new.content_hash is distinct from old.content_hash then
      stage_name := case when new.publication_state = 'draft' then 'draft' else 'published' end;
      insert into public.pipeline_events (stage, status, content_type, content_id, message, actor_id)
      values (stage_name, 'info', 'blog', new.id::text, 'Blog actualizado', auth.uid());
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_blog_posts_pipeline_event on public.blog_posts;
create trigger trg_blog_posts_pipeline_event
after insert or update on public.blog_posts
for each row
execute function public.blog_posts_pipeline_event_trigger();

create or replace view public.admin_schedule_jobs as
select
  j.id,
  j.job_type,
  j.source,
  j.title,
  j.content_type,
  j.content_id,
  j.status,
  j.priority,
  j.scheduled_for,
  j.started_at,
  j.finished_at,
  j.attempts,
  j.max_attempts,
  j.error,
  j.created_at,
  j.updated_at,
  coalesce(n.title, b.title, j.title) as content_title
from public.automation_jobs j
left join public.news_items n
  on j.content_type = 'news'
 and j.content_id = n.id::text
left join public.blog_posts b
  on j.content_type = 'blog'
 and j.content_id = b.id::text;

-- 3) Strict admin-only RLS for queue/ops telemetry
alter table public.automation_jobs enable row level security;
alter table public.pipeline_events enable row level security;
alter table public.publish_queue enable row level security;
alter table public.reports enable row level security;

drop policy if exists "automation_jobs admin all" on public.automation_jobs;
create policy "automation_jobs admin all"
on public.automation_jobs
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "pipeline_events admin all" on public.pipeline_events;
create policy "pipeline_events admin all"
on public.pipeline_events
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "publish queue admin all" on public.publish_queue;
drop policy if exists "publish_queue admin all" on public.publish_queue;
drop policy if exists "publish_queue admin all strict" on public.publish_queue;
create policy "publish_queue admin all strict"
on public.publish_queue
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "reports admin all" on public.reports;
drop policy if exists "reports admin all strict" on public.reports;
create policy "reports admin all strict"
on public.reports
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

commit;

notify pgrst, 'reload schema';
