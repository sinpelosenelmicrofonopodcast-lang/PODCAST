-- Blog posts base table (required for /blog and /admin/blog)

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text,
  body text,
  cover_url text,
  author_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_created_at_base_idx on public.blog_posts(created_at desc);

alter table public.blog_posts enable row level security;

-- Public read (anyone can read blog for SEO).
drop policy if exists "blog_posts public read" on public.blog_posts;
create policy "blog_posts public read"
on public.blog_posts
for select
to anon, authenticated
using (true);

-- Admin write (insert/update/delete)
drop policy if exists "blog_posts admin write" on public.blog_posts;
create policy "blog_posts admin write"
on public.blog_posts
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = 'admin'
  )
);

notify pgrst, 'reload schema';

