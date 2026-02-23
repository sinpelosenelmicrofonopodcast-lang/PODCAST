-- News automation sources + admin RLS
-- Run in Supabase SQL Editor.

begin;

create extension if not exists pgcrypto with schema extensions;

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

create table if not exists public.news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  rss_url text not null unique,
  region text,
  default_categories text[] not null default '{}'::text[],
  is_active boolean not null default true,
  auto_publish boolean not null default true,
  auto_post_facebook boolean not null default false,
  max_items_per_run integer not null default 12,
  scan_every_min integer not null default 15,
  trust_score integer not null default 60,
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'news_sources_max_items_check'
      and conrelid = 'public.news_sources'::regclass
  ) then
    alter table public.news_sources
      add constraint news_sources_max_items_check check (max_items_per_run between 1 and 50);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'news_sources_scan_every_check'
      and conrelid = 'public.news_sources'::regclass
  ) then
    alter table public.news_sources
      add constraint news_sources_scan_every_check check (scan_every_min between 5 and 1440);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'news_sources_trust_score_check'
      and conrelid = 'public.news_sources'::regclass
  ) then
    alter table public.news_sources
      add constraint news_sources_trust_score_check check (trust_score between 0 and 100);
  end if;
end$$;

create or replace function public.news_sources_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_news_sources_before_update on public.news_sources;
create trigger trg_news_sources_before_update
before update on public.news_sources
for each row
execute function public.news_sources_before_update();

alter table public.news_sources enable row level security;

drop policy if exists "news_sources admin all" on public.news_sources;
create policy "news_sources admin all"
on public.news_sources
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Starter sources for Sin Pelos (safe upsert)
insert into public.news_sources (
  name,
  rss_url,
  region,
  default_categories,
  is_active,
  auto_publish,
  auto_post_facebook,
  max_items_per_run,
  trust_score
)
values
  ('El Nuevo Dia', 'https://www.elnuevodia.com/arc/outboundfeeds/rss/', 'PR', array['PR'], true, true, false, 12, 78),
  ('Primera Hora', 'https://www.primerahora.com/arc/outboundfeeds/rss/', 'PR', array['PR'], true, true, false, 12, 74),
  ('AP News', 'https://apnews.com/rss', 'USA', array['USA'], true, true, false, 12, 82),
  ('CNN Top Stories', 'https://rss.cnn.com/rss/cnn_topstories.rss', 'USA', array['USA'], true, true, false, 12, 68),
  ('Google News Trending PR', 'https://news.google.com/rss/search?q=Puerto+Rico&hl=es-419&gl=PR&ceid=PR:es-419', 'PR', array['PR', 'Mundo'], true, false, false, 15, 55),
  ('BBC Mundo', 'https://feeds.bbci.co.uk/mundo/rss.xml', 'Mundo', array['Mundo'], true, true, false, 12, 76)
on conflict (name) do update
set
  rss_url = excluded.rss_url,
  region = excluded.region,
  default_categories = excluded.default_categories,
  is_active = excluded.is_active,
  auto_publish = excluded.auto_publish,
  auto_post_facebook = excluded.auto_post_facebook,
  max_items_per_run = excluded.max_items_per_run,
  trust_score = excluded.trust_score,
  updated_at = now();

commit;

notify pgrst, 'reload schema';
