-- Promotions targeting by section (blog, noticias, confesiones, etc.)
-- Allows reducing repetition and improving reader experience.

alter table if exists public.promotions
  add column if not exists target_sections text[];

-- Optional index for array containment queries (if used later).
do $$
begin
  if to_regclass('public.promotions') is not null then
    create index if not exists promotions_target_sections_gin
      on public.promotions
      using gin (target_sections);
  end if;
end$$;

notify pgrst, 'reload schema';

