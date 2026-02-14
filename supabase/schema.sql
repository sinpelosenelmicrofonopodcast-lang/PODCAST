-- Sin Pelos en el Micrófono - MVP Schema (Supabase)

create extension if not exists "pgcrypto";

-- Users profile table
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text unique not null,
  avatar_url text,
  bio text,
  birth_date date not null,
  is_21_confirmed boolean not null default false,
  legal_ack_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table if not exists public.user_roles (
  user_id uuid references public.users(id) on delete cascade,
  role_id uuid references public.roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create table if not exists public.memberships (
  user_id uuid primary key references public.users(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active',
  stripe_customer_id text,
  stripe_sub_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  space text not null
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text,
  body text,
  author_id uuid references public.users(id) on delete set null,
  visibility text not null default 'public',
  category_id uuid references public.categories(id),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users(id) on delete set null,
  type text not null,
  url text not null,
  thumbnail_url text,
  duration integer,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.external_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  external_id text not null,
  title text,
  caption text,
  media_url text,
  metrics jsonb,
  posted_at timestamptz,
  source_url text
);

create table if not exists public.publish_queue (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references public.content_items(id) on delete cascade,
  platform text not null,
  status text not null default 'queued',
  scheduled_for timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  author_id uuid references public.users(id) on delete set null,
  space text not null,
  category_id uuid references public.categories(id),
  visibility text not null default 'public',
  status text not null default 'published',
  created_at timestamptz not null default now()
);

create table if not exists public.replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.threads(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  body text not null,
  parent_reply_id uuid references public.replies(id),
  created_at timestamptz not null default now()
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  content_id uuid not null,
  type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete set null,
  content_id uuid not null,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.news_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  analysis text,
  source_url text,
  tags text[],
  author_id uuid references public.users(id) on delete set null,
  published_at timestamptz not null default now()
);

create table if not exists public.confessions (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  author_id uuid references public.users(id) on delete set null,
  level text not null default 'public',
  status text not null default 'published',
  created_at timestamptz not null default now()
);

create table if not exists public.theories (
  id uuid primary key default gen_random_uuid(),
  theory text not null,
  source text,
  opinion text,
  question text,
  author_id uuid references public.users(id) on delete set null,
  subcategory text,
  created_at timestamptz not null default now()
);

create table if not exists public.live_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  visibility text not null default 'members',
  provider text,
  join_url text
);

create table if not exists public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  type text not null,
  points integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  criteria text
);

create table if not exists public.user_badges (
  user_id uuid references public.users(id) on delete cascade,
  badge_id uuid references public.badges(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- RLS
alter table public.users enable row level security;
alter table public.memberships enable row level security;
alter table public.threads enable row level security;
alter table public.replies enable row level security;
alter table public.confessions enable row level security;
alter table public.theories enable row level security;
alter table public.news_items enable row level security;

create policy "public read profiles" on public.users for select using (true);
create policy "users can update own profile" on public.users for update using (auth.uid() = id);
create policy "users can insert own profile" on public.users for insert with check (auth.uid() = id);

create policy "memberships self read" on public.memberships for select using (auth.uid() = user_id);

create policy "threads public read" on public.threads for select using (visibility = 'public');
create policy "threads members read" on public.threads for select using (
  visibility = 'members' and auth.uid() is not null
);
create policy "threads paid read" on public.threads for select using (
  visibility = 'paid' and auth.uid() is not null
);
create policy "threads create" on public.threads for insert with check (auth.uid() = author_id);

create policy "replies read" on public.replies for select using (true);
create policy "replies create" on public.replies for insert with check (auth.uid() = author_id);

create policy "news public read" on public.news_items for select using (true);

create policy "confessions public read" on public.confessions for select using (level = 'public');
create policy "confessions paid read" on public.confessions for select using (
  level = 'paid' and auth.uid() is not null
);
create policy "confessions create" on public.confessions for insert with check (auth.uid() = author_id);

create policy "theories read" on public.theories for select using (auth.uid() is not null);
create policy "theories create" on public.theories for insert with check (auth.uid() = author_id);
