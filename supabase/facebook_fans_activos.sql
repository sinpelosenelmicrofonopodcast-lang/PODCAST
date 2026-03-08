-- Facebook Fans Activos (mini CRM interno de interacciones de página)
-- NOTA: tokens sensibles deben vivir en ENV del servidor.
-- Esta tabla guarda referencia segura al token (no token crudo) por defecto.

begin;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.facebook_fans_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.facebook_pages (
  id uuid primary key default gen_random_uuid(),
  page_id text not null unique,
  page_name text,
  connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facebook_connected_accounts (
  id uuid primary key default gen_random_uuid(),
  page_id text not null references public.facebook_pages(page_id) on delete cascade,
  access_token text,
  token_expires_at timestamptz,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facebook_connected_accounts_page_id_unique unique (page_id)
);

create table if not exists public.facebook_posts (
  id uuid primary key default gen_random_uuid(),
  page_id text not null references public.facebook_pages(page_id) on delete cascade,
  fb_post_id text not null unique,
  message text,
  permalink_url text,
  created_time timestamptz,
  comment_count int not null default 0,
  reaction_count int not null default 0,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facebook_post_comments (
  id uuid primary key default gen_random_uuid(),
  fb_comment_id text not null unique,
  fb_post_id text not null references public.facebook_posts(fb_post_id) on delete cascade,
  fb_user_id text,
  user_name text,
  message text,
  created_time timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.facebook_post_reactions (
  id uuid primary key default gen_random_uuid(),
  fb_post_id text not null references public.facebook_posts(fb_post_id) on delete cascade,
  fb_user_id text not null,
  user_name text,
  reaction_type text,
  created_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);

create table if not exists public.facebook_fans (
  id uuid primary key default gen_random_uuid(),
  fb_user_id text not null unique,
  user_name text,
  total_comments int not null default 0,
  total_reactions int not null default 0,
  engagement_score int not null default 0,
  posts_interacted_count int not null default 0,
  last_interacted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facebook_sync_runs (
  id uuid primary key default gen_random_uuid(),
  page_id text references public.facebook_pages(page_id) on delete set null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  posts_synced int not null default 0,
  comments_synced int not null default 0,
  reactions_synced int not null default 0,
  fans_updated int not null default 0,
  error_log text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_facebook_posts_page_created
  on public.facebook_posts(page_id, created_time desc);
create index if not exists idx_facebook_posts_fb_post_id on public.facebook_posts(fb_post_id);
create index if not exists idx_facebook_comments_post on public.facebook_post_comments(fb_post_id);
create index if not exists idx_facebook_comments_user on public.facebook_post_comments(fb_user_id);
create index if not exists idx_facebook_comments_created on public.facebook_post_comments(created_time desc);
create index if not exists idx_facebook_reactions_post on public.facebook_post_reactions(fb_post_id);
create index if not exists idx_facebook_reactions_user on public.facebook_post_reactions(fb_user_id);
create index if not exists idx_facebook_reactions_created on public.facebook_post_reactions(created_at desc);
create index if not exists idx_facebook_fans_score on public.facebook_fans(engagement_score desc, last_interacted_at desc);
create index if not exists idx_facebook_sync_runs_created on public.facebook_sync_runs(created_at desc);
create index if not exists idx_facebook_sync_runs_status on public.facebook_sync_runs(status);

create unique index if not exists facebook_post_reactions_unique_user_post_type
  on public.facebook_post_reactions(fb_post_id, fb_user_id, reaction_type);

drop trigger if exists trg_facebook_pages_updated_at on public.facebook_pages;
create trigger trg_facebook_pages_updated_at
before update on public.facebook_pages
for each row execute function public.facebook_fans_set_updated_at();

drop trigger if exists trg_facebook_connected_accounts_updated_at on public.facebook_connected_accounts;
create trigger trg_facebook_connected_accounts_updated_at
before update on public.facebook_connected_accounts
for each row execute function public.facebook_fans_set_updated_at();

drop trigger if exists trg_facebook_posts_updated_at on public.facebook_posts;
create trigger trg_facebook_posts_updated_at
before update on public.facebook_posts
for each row execute function public.facebook_fans_set_updated_at();

drop trigger if exists trg_facebook_fans_updated_at on public.facebook_fans;
create trigger trg_facebook_fans_updated_at
before update on public.facebook_fans
for each row execute function public.facebook_fans_set_updated_at();

drop trigger if exists trg_facebook_sync_runs_updated_at on public.facebook_sync_runs;
create trigger trg_facebook_sync_runs_updated_at
before update on public.facebook_sync_runs
for each row execute function public.facebook_fans_set_updated_at();

alter table public.facebook_pages enable row level security;
alter table public.facebook_connected_accounts enable row level security;
alter table public.facebook_posts enable row level security;
alter table public.facebook_post_comments enable row level security;
alter table public.facebook_post_reactions enable row level security;
alter table public.facebook_fans enable row level security;
alter table public.facebook_sync_runs enable row level security;

drop policy if exists "facebook_pages admin all" on public.facebook_pages;
create policy "facebook_pages admin all"
on public.facebook_pages
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "facebook_connected_accounts admin all" on public.facebook_connected_accounts;
create policy "facebook_connected_accounts admin all"
on public.facebook_connected_accounts
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "facebook_posts admin all" on public.facebook_posts;
create policy "facebook_posts admin all"
on public.facebook_posts
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "facebook_post_comments admin all" on public.facebook_post_comments;
create policy "facebook_post_comments admin all"
on public.facebook_post_comments
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "facebook_post_reactions admin all" on public.facebook_post_reactions;
create policy "facebook_post_reactions admin all"
on public.facebook_post_reactions
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "facebook_fans admin all" on public.facebook_fans;
create policy "facebook_fans admin all"
on public.facebook_fans
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "facebook_sync_runs admin all" on public.facebook_sync_runs;
create policy "facebook_sync_runs admin all"
on public.facebook_sync_runs
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

grant select, insert, update, delete on public.facebook_pages to authenticated;
grant select, insert, update, delete on public.facebook_connected_accounts to authenticated;
grant select, insert, update, delete on public.facebook_posts to authenticated;
grant select, insert, update, delete on public.facebook_post_comments to authenticated;
grant select, insert, update, delete on public.facebook_post_reactions to authenticated;
grant select, insert, update, delete on public.facebook_fans to authenticated;
grant select, insert, update, delete on public.facebook_sync_runs to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;

