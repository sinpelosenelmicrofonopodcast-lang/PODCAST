begin;

create table if not exists public.episode_editorials (
  id uuid primary key default gen_random_uuid(),
  episode_key text not null unique,
  episode_slug text,
  episode_code text,
  youtube_url text,
  title text not null,
  guest_name text,
  episode_type text not null default 'guest' check (episode_type in ('guest','hosts','mixed')),
  intro text,
  person_story text,
  impact_summary text,
  lessons jsonb not null default '[]'::jsonb,
  host_points jsonb not null default '[]'::jsonb,
  quotes jsonb not null default '[]'::jsonb,
  closing_reflection text,
  source_transcript_id uuid references public.editorial_episode_sources(id) on delete set null,
  source_run_id uuid references public.editorial_runs(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_episode_editorials_status_published
  on public.episode_editorials (status, published_at desc);
create index if not exists idx_episode_editorials_slug
  on public.episode_editorials (episode_slug);
create index if not exists idx_episode_editorials_code
  on public.episode_editorials (episode_code);

alter table public.episode_editorials enable row level security;

revoke all on table public.episode_editorials from anon, authenticated;
grant select on table public.episode_editorials to anon, authenticated;
grant select, insert, update, delete on table public.episode_editorials to service_role;

drop policy if exists "episode_editorials_public_read_published" on public.episode_editorials;
create policy "episode_editorials_public_read_published"
  on public.episode_editorials
  for select
  to anon, authenticated
  using (status = 'published');

commit;
