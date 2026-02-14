insert into public.categories (name, space)
values
  ('Opinión sin filtro', 'foro'),
  ('Debate social', 'foro'),
  ('Cultura PR / USA', 'foro'),
  ('Medios y manipulación', 'foro'),
  ('Realidades incómodas', 'foro');

insert into public.news_items (title, summary, analysis, source_url, tags)
values
  ('Puerto Rico: el cambio silencioso en medios locales', 'Resumen breve y análisis estilo Sin Pelos.', 'Lectura crítica inicial.', 'https://example.com', '{medios,pr}'),
  ('USA: narrativa oficial vs datos reales', 'Breakdown con fuentes y preguntas abiertas.', 'Análisis preliminar.', 'https://example.com', '{usa,datos}');

insert into public.confessions (body, level)
values
  ('No confío en ningún medio desde 2020 y me siento mejor.', 'public');

insert into public.external_posts (platform, external_id, title, caption, metrics, posted_at, source_url)
values
  ('YouTube', 'yt-1', 'La verdad incómoda detrás del algoritmo', 'Episodio completo: cómo las plataformas moldean la narrativa.', '{"views":42000,"comments":2400,"shares":1900}', now(), 'https://example.com');
