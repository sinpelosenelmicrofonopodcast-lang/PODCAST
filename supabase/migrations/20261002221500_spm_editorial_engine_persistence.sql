begin;

create table if not exists public.editorial_episode_sources (
  id uuid primary key default gen_random_uuid(),
  episode_code text not null unique,
  title text not null,
  guest text,
  source_url text,
  source_provider text not null default 'manual',
  source_external_id text,
  drive_file_id text,
  metadata jsonb not null default '{}'::jsonb,
  transcript text not null,
  transcript_char_count integer not null default 0,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_editorial_episode_sources_active_code
  on public.editorial_episode_sources (active, episode_code desc);

alter table public.editorial_episode_sources enable row level security;
revoke all on table public.editorial_episode_sources from anon, authenticated;
grant select, insert, update, delete on table public.editorial_episode_sources to service_role;

create table if not exists public.editorial_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('podcast', 'news')),
  episode_source_id uuid references public.editorial_episode_sources(id) on delete set null,
  source_key text,
  input_snapshot jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  score integer not null default 0 check (score between 0 and 100),
  publication_recommendation text not null default 'draft' check (publication_recommendation in ('draft', 'review', 'ready')),
  status text not null default 'draft' check (status in ('draft', 'review', 'archived')),
  model text,
  blog_post_id uuid references public.blog_posts(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_editorial_runs_episode_created
  on public.editorial_runs (episode_source_id, created_at desc);
create index if not exists idx_editorial_runs_status_created
  on public.editorial_runs (status, created_at desc);
create index if not exists idx_editorial_runs_blog_post_id
  on public.editorial_runs (blog_post_id) where blog_post_id is not null;

alter table public.editorial_runs enable row level security;
revoke all on table public.editorial_runs from anon, authenticated;
grant select, insert, update, delete on table public.editorial_runs to service_role;

commit;
