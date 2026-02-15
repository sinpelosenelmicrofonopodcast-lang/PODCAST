-- Newsletter subscribers (lead capture)

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null default 'active', -- active | unsubscribed | bounced
  source_path text,
  preferred_language text,
  user_id uuid references public.users(id) on delete set null,
  subscribed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists newsletter_subscribers_email_unique
  on public.newsletter_subscribers (lower(email));

create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status);

alter table public.newsletter_subscribers enable row level security;

-- Reset policies to avoid depending on legacy helpers (e.g. public.is_admin()).
drop policy if exists "newsletter public upsert" on public.newsletter_subscribers;
drop policy if exists "newsletter admin read" on public.newsletter_subscribers;
drop policy if exists "newsletter admin write" on public.newsletter_subscribers;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'newsletter_subscribers'
      and policyname = 'newsletter public upsert'
  ) then
    create policy "newsletter public upsert"
      on public.newsletter_subscribers
      for insert
      to anon, authenticated
      with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'newsletter_subscribers'
      and policyname = 'newsletter admin read'
  ) then
    create policy "newsletter admin read"
      on public.newsletter_subscribers
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid()
            and r.name = 'admin'
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'newsletter_subscribers'
      and policyname = 'newsletter admin write'
  ) then
    create policy "newsletter admin write"
      on public.newsletter_subscribers
      for update
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
  end if;
end$$;

notify pgrst, 'reload schema';
