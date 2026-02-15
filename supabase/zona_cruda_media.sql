-- Zona Cruda: media uploads (images + short videos) using private Supabase Storage + signed URLs

-- 1) Storage bucket (private)
insert into storage.buckets (id, name, public)
values ('ugc', 'ugc', false)
on conflict (id) do nothing;

-- 2) Thread media table
create table if not exists public.thread_media (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  storage_path text not null,
  kind text not null check (kind in ('image', 'video')),
  mime_type text,
  created_at timestamptz not null default now()
);

alter table public.thread_media enable row level security;

-- Helper predicate: paid + 21+ (join users + memberships)
-- Note: this intentionally checks both profile and membership.

-- 3) Tighten paid thread access: require paid membership for visibility='paid'
-- (This protects Zona Cruda threads and any other paid threads.)
alter policy "threads paid read"
  on public.threads
  using (
    visibility = 'paid'
    and auth.uid() is not null
    and exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.status = 'active'
        and m.plan = 'paid'
    )
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.is_21_confirmed = true
        and u.terms_accepted = true
        and u.legal_ack_at is not null
    )
  );

-- 4) Media read: allowed when you can read the parent thread
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'thread_media'
      and policyname = 'thread media read via thread'
  ) then
    create policy "thread media read via thread"
      on public.thread_media
      for select
      using (
        exists (
          select 1
          from public.threads t
          where t.id = thread_id
            and (
              t.visibility = 'public'
              or (t.visibility = 'members' and auth.uid() is not null)
              or (
                t.visibility = 'paid'
                and auth.uid() is not null
                and exists (
                  select 1
                  from public.memberships m
                  where m.user_id = auth.uid()
                    and m.status = 'active'
                    and m.plan = 'paid'
                )
              )
            )
        )
      );
  end if;
end$$;

-- 5) Media write: only the author of the thread, and only if paid+21+ (Zona Cruda is paid)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'thread_media'
      and policyname = 'thread media author insert'
  ) then
    create policy "thread media author insert"
      on public.thread_media
      for insert
      with check (
        auth.uid() is not null
        and exists (
          select 1
          from public.threads t
          where t.id = thread_id
            and t.author_id = auth.uid()
            and t.visibility = 'paid'
        )
        and exists (
          select 1
          from public.memberships m
          where m.user_id = auth.uid()
            and m.status = 'active'
            and m.plan = 'paid'
        )
        and exists (
          select 1
          from public.users u
          where u.id = auth.uid()
            and u.is_21_confirmed = true
            and u.terms_accepted = true
            and u.legal_ack_at is not null
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'thread_media'
      and policyname = 'thread media author delete'
  ) then
    create policy "thread media author delete"
      on public.thread_media
      for delete
      using (
        auth.uid() is not null
        and exists (
          select 1
          from public.threads t
          where t.id = thread_id
            and t.author_id = auth.uid()
        )
      );
  end if;
end$$;

-- 6) Storage policies (bucket: ugc)
-- Allow paid+21 users to upload to ugc (their own objects)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ugc upload paid'
  ) then
    create policy "ugc upload paid"
      on storage.objects
      for insert
      with check (
        bucket_id = 'ugc'
        and auth.uid() is not null
        and owner = auth.uid()
        and exists (
          select 1
          from public.memberships m
          where m.user_id = auth.uid()
            and m.status = 'active'
            and m.plan = 'paid'
        )
        and exists (
          select 1
          from public.users u
          where u.id = auth.uid()
            and u.is_21_confirmed = true
            and u.terms_accepted = true
            and u.legal_ack_at is not null
        )
      );
  end if;
end$$;

-- Allow paid+21 users to read ugc via signed URLs (storage download uses select)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ugc read paid'
  ) then
    create policy "ugc read paid"
      on storage.objects
      for select
      using (
        bucket_id = 'ugc'
        and auth.uid() is not null
        and exists (
          select 1
          from public.memberships m
          where m.user_id = auth.uid()
            and m.status = 'active'
            and m.plan = 'paid'
        )
      );
  end if;
end$$;

