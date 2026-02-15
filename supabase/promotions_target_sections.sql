-- Promotions targeting by section (blog, noticias, confesionario, etc.)

alter table if exists public.promotions
  add column if not exists target_sections text[];

create index if not exists promotions_target_sections_gin
  on public.promotions
  using gin (target_sections);

notify pgrst, 'reload schema';

