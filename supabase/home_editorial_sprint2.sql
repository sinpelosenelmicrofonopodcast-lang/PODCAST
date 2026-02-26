-- Sprint 2: Opinion del dia editable desde home_settings

alter table public.home_settings
  add column if not exists opinion_title text not null default 'Opinión del día',
  add column if not exists opinion_body text not null default 'Aquí va la postura editorial del día.',
  add column if not exists opinion_cta_label text not null default 'Ir al foro',
  add column if not exists opinion_cta_href text not null default '/foro';

update public.home_settings
set
  opinion_title = coalesce(nullif(trim(opinion_title), ''), 'Opinión del día'),
  opinion_body = coalesce(nullif(trim(opinion_body), ''), 'Aquí va la postura editorial del día.'),
  opinion_cta_label = coalesce(nullif(trim(opinion_cta_label), ''), 'Ir al foro'),
  opinion_cta_href = coalesce(nullif(trim(opinion_cta_href), ''), '/foro');
