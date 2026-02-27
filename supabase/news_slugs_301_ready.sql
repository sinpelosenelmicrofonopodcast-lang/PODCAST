-- News slugs migration (safe, idempotent)
-- Objetivo:
-- 1) Añadir slug en news_items.
-- 2) Backfill de slugs desde title.
-- 3) Garantizar unicidad.
-- 4) Mantener slug automático en inserts/updates.

alter table if exists public.news_items
  add column if not exists slug text;

create or replace function public.slugify_news(input_text text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(
      coalesce(input_text, ''),
      'ÁÀÂÄÃáàâäãÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑñÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc'
    )),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
$$;

create or replace function public.ensure_news_slug()
returns trigger
language plpgsql
as $$
declare
  base_slug text;
  candidate text;
  suffix int := 1;
begin
  base_slug := public.slugify_news(
    case
      when new.slug is not null and btrim(new.slug) <> '' then new.slug
      else coalesce(new.title, '')
    end
  );

  if base_slug is null or base_slug = '' then
    base_slug := 'noticia';
  end if;

  candidate := base_slug;
  while exists (
    select 1
    from public.news_items n
    where n.slug = candidate
      and n.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix::text;
  end loop;

  new.slug := candidate;
  return new;
end;
$$;

update public.news_items n
set slug = public.slugify_news(coalesce(nullif(n.slug, ''), n.title, n.id::text))
where n.slug is null
   or btrim(n.slug) = '';

-- Normaliza slugs existentes por si tienen espacios o caracteres no válidos.
update public.news_items n
set slug = public.slugify_news(n.slug)
where n.slug is not null
  and btrim(n.slug) <> ''
  and n.slug <> public.slugify_news(n.slug);

-- Resuelve duplicados ya existentes.
with ranked as (
  select
    id,
    slug,
    row_number() over (partition by slug order by coalesce(published_at, updated_at) asc, id asc) as rn
  from public.news_items
  where slug is not null and btrim(slug) <> ''
)
update public.news_items n
set slug = n.slug || '-' || (substr(n.id::text, 1, 8))
from ranked r
where n.id = r.id
  and r.rn > 1;

drop trigger if exists trg_news_items_ensure_slug on public.news_items;
create trigger trg_news_items_ensure_slug
before insert or update of title, slug
on public.news_items
for each row
execute function public.ensure_news_slug();

create unique index if not exists news_items_slug_unique
  on public.news_items (slug);
