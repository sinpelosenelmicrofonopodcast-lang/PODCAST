begin;

alter table if exists public.scheduled_posts
  add column if not exists link_url text,
  add column if not exists campaign_key text,
  add column if not exists campaign_label text,
  add column if not exists publish_as text not null default 'feed';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scheduled_posts_platform_check'
      and conrelid = 'public.scheduled_posts'::regclass
  ) then
    alter table public.scheduled_posts
      add constraint scheduled_posts_platform_check
      check (platform in ('facebook_page', 'instagram_feed', 'instagram_story'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scheduled_posts_publish_as_check'
      and conrelid = 'public.scheduled_posts'::regclass
  ) then
    alter table public.scheduled_posts
      add constraint scheduled_posts_publish_as_check
      check (publish_as in ('feed', 'story'));
  end if;
end
$$;

create or replace function public.claim_due_scheduled_posts(p_limit integer default 5)
returns setof public.scheduled_posts
language plpgsql
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 50));
begin
  return query
  with claimed as (
    select sp.id
    from public.scheduled_posts sp
    where sp.status = 'queued'
      and sp.scheduled_for <= now()
    order by sp.scheduled_for asc
    for update skip locked
    limit v_limit
  ), updated as (
    update public.scheduled_posts sp
    set status = 'publishing',
        error = null,
        updated_at = now()
    where sp.id in (select id from claimed)
    returning sp.*
  )
  select * from updated order by scheduled_for asc;
end;
$$;

select pg_notify('pgrst', 'reload schema');

commit;
