begin;

create extension if not exists pg_trgm with schema extensions;

alter table public.news_articles
  add column if not exists story_normalized_title text;

create or replace function public.spm_normalize_story_title(input_title text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(coalesce(input_title, '')),
          '^(breaking|urgent|urgente|ultima hora|última hora|tx|texas|pr|puerto rico|usa|mundo)\s*[:\-–—]\s*',
          '',
          'i'
        ),
        '\s+[\-–—]\s+[^\-–—]{2,60}$',
        '',
        'i'
      ),
      '[^a-z0-9áéíóúüñ]+',
      ' ',
      'g'
    )
  );
$$;

update public.news_articles
set story_normalized_title = public.spm_normalize_story_title(coalesce(original_title, title))
where story_normalized_title is null
  and created_at >= now() - interval '7 days';

create index if not exists idx_news_articles_story_recent
  on public.news_articles (created_at desc, status, region);

create or replace function public.spm_news_dedupe_guard()
returns trigger
language plpgsql
set search_path = public, pg_catalog, extensions
as $$
declare
  v_norm text;
  v_duplicate_id uuid;
  v_similarity real;
begin
  v_norm := public.spm_normalize_story_title(coalesce(new.original_title, new.title));
  new.story_normalized_title := v_norm;

  if coalesce(new.status, 'draft') not in ('draft', 'pending_review') or length(v_norm) < 24 then
    return new;
  end if;

  select a.id,
         extensions.similarity(a.story_normalized_title, v_norm)
    into v_duplicate_id, v_similarity
  from public.news_articles a
  where a.created_at >= now() - interval '24 hours'
    and a.status in ('draft', 'pending_review', 'published')
    and a.story_normalized_title is not null
    and length(a.story_normalized_title) >= 24
    and (new.region is null or a.region is null or a.region = new.region)
    and (
      a.story_normalized_title = v_norm
      or extensions.similarity(a.story_normalized_title, v_norm) >= 0.72
    )
  order by extensions.similarity(a.story_normalized_title, v_norm) desc, a.created_at desc
  limit 1;

  if v_duplicate_id is not null then
    raise unique_violation
      using message = 'SPM duplicate story cluster',
            detail = format('Existing story %s matched at similarity %.3f', v_duplicate_id, coalesce(v_similarity, 1));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_spm_news_dedupe_guard on public.news_articles;
create trigger trg_spm_news_dedupe_guard
before insert on public.news_articles
for each row
execute function public.spm_news_dedupe_guard();

revoke all on function public.spm_normalize_story_title(text) from public, anon, authenticated;
revoke all on function public.spm_news_dedupe_guard() from public, anon, authenticated;
grant execute on function public.spm_normalize_story_title(text) to service_role;
grant execute on function public.spm_news_dedupe_guard() to service_role;

commit;
