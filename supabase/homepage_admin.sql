-- Home modules: settings, promotions and events security

-- 1) Home settings (single-row style table; latest row wins)
create table if not exists public.home_settings (
  id uuid primary key default gen_random_uuid(),
  hero_kicker text not null default 'Plataforma 21+ · Sin censura ideológica',
  hero_title text not null default 'Sin Pelos en el Micrófono',
  hero_subtitle text not null default 'Centro de contenido, noticias y comunidad real. Hablar claro no es opción: es la norma.',
  show_latest_news boolean not null default true,
  show_latest_blog boolean not null default true,
  show_latest_community_post boolean not null default true,
  show_upcoming_events boolean not null default true,
  show_promotions boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 2) Paid promotions/ad placements
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  cta_label text,
  cta_url text,
  placement text not null default 'home',
  display_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.home_settings enable row level security;
alter table public.promotions enable row level security;
alter table public.live_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'home_settings'
      and policyname = 'home settings public read'
  ) then
    create policy "home settings public read"
      on public.home_settings
      for select
      using (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'promotions'
      and policyname = 'promotions public read active'
  ) then
    create policy "promotions public read active"
      on public.promotions
      for select
      using (
        is_active = true
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'live_events'
      and policyname = 'live events public read'
  ) then
    create policy "live events public read"
      on public.live_events
      for select
      using (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'home_settings'
      and policyname = 'home settings admin all'
  ) then
    create policy "home settings admin all"
      on public.home_settings
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
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'promotions'
      and policyname = 'promotions admin all'
  ) then
    create policy "promotions admin all"
      on public.promotions
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
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'live_events'
      and policyname = 'live events admin all'
  ) then
    create policy "live events admin all"
      on public.live_events
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
  end if;
end$$;

-- Seed one editable row if empty
insert into public.home_settings (hero_kicker, hero_title, hero_subtitle)
select
  'Plataforma 21+ · Sin censura ideológica',
  'Sin Pelos en el Micrófono',
  'Centro de contenido, noticias y comunidad real. Hablar claro no es opción: es la norma.'
where not exists (select 1 from public.home_settings);
