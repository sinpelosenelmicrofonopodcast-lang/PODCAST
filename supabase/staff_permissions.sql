-- Staff permissions by section.
-- Admin users can grant/revoke granular permissions to editors/moderators.

create table if not exists public.user_permissions (
  user_id uuid not null references public.users(id) on delete cascade,
  permission text not null,
  granted_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, permission),
  constraint user_permissions_permission_check check (
    permission in (
      'manage_home',
      'manage_news',
      'manage_news_sources',
      'manage_blog',
      'manage_events',
      'manage_promotions',
      'manage_newsletter',
      'manage_guest_requests',
      'moderate_community',
      'moderate_confessions',
      'moderate_theories',
      'view_stats',
      'view_reports',
      'view_schedule'
    )
  )
);

create index if not exists idx_user_permissions_user_id on public.user_permissions(user_id);
create index if not exists idx_user_permissions_permission on public.user_permissions(permission);

alter table public.user_permissions enable row level security;

drop policy if exists "user_permissions self read" on public.user_permissions;
create policy "user_permissions self read"
on public.user_permissions
for select
using (auth.uid() = user_id);

drop policy if exists "user_permissions admin all" on public.user_permissions;
create policy "user_permissions admin all"
on public.user_permissions
for all
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

grant select, insert, update, delete on public.user_permissions to authenticated;

-- ========= Section-based staff policies =========
-- Additive policies (OR with existing admin policies).

-- news_items
drop policy if exists "news_items staff manage" on public.news_items;
create policy "news_items staff manage"
on public.news_items
for all
using (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.permission = 'manage_news'
  )
)
with check (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.permission = 'manage_news'
  )
);

-- blog_posts
drop policy if exists "blog_posts staff manage" on public.blog_posts;
create policy "blog_posts staff manage"
on public.blog_posts
for all
using (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.permission = 'manage_blog'
  )
)
with check (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.permission = 'manage_blog'
  )
);

-- live_events
drop policy if exists "live_events staff manage" on public.live_events;
create policy "live_events staff manage"
on public.live_events
for all
using (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.permission = 'manage_events'
  )
)
with check (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.permission = 'manage_events'
  )
);

-- promotions
drop policy if exists "promotions staff manage" on public.promotions;
create policy "promotions staff manage"
on public.promotions
for all
using (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.permission = 'manage_promotions'
  )
)
with check (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.permission = 'manage_promotions'
  )
);

-- guest_requests
drop policy if exists "guest_requests staff read" on public.guest_requests;
create policy "guest_requests staff read"
on public.guest_requests
for select
using (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.permission = 'manage_guest_requests'
  )
);

drop policy if exists "guest_requests staff update" on public.guest_requests;
create policy "guest_requests staff update"
on public.guest_requests
for update
using (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.permission = 'manage_guest_requests'
  )
)
with check (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.permission = 'manage_guest_requests'
  )
);

drop policy if exists "guest_requests staff delete" on public.guest_requests;
create policy "guest_requests staff delete"
on public.guest_requests
for delete
using (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.permission = 'manage_guest_requests'
  )
);

-- newsletter_subscribers
drop policy if exists "newsletter staff manage" on public.newsletter_subscribers;
create policy "newsletter staff manage"
on public.newsletter_subscribers
for all
using (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.permission = 'manage_newsletter'
  )
)
with check (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.permission = 'manage_newsletter'
  )
);
