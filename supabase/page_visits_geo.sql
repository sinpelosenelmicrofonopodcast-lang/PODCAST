-- Geo fields for analytics by country/city
alter table if exists public.page_visits
  add column if not exists country_code text,
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists city text;

create index if not exists page_visits_country_code_idx on public.page_visits(country_code);
create index if not exists page_visits_country_idx on public.page_visits(country);
create index if not exists page_visits_city_idx on public.page_visits(city);
