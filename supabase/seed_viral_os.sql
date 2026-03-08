-- Seed base for Viral Content OS

insert into public.news_sources (
  name,
  type,
  rss_url,
  category,
  region,
  active,
  priority,
  trust_score,
  meta
)
values
  ('Google News PR', 'rss', 'https://news.google.com/rss/search?q=Puerto+Rico&hl=es-419&gl=PR&ceid=PR:es-419', 'Noticias', 'PR', true, 90, 70, '{"seed":true}'::jsonb),
  ('BBC Mundo', 'rss', 'https://feeds.bbci.co.uk/mundo/rss.xml', 'Mundo', 'Mundo', true, 75, 80, '{"seed":true}'::jsonb),
  ('CNN Top', 'rss', 'https://rss.cnn.com/rss/cnn_topstories.rss', 'USA', 'USA', true, 65, 68, '{"seed":true}'::jsonb),
  ('ESPN MLB', 'rss', 'https://www.espn.com/espn/rss/mlb/news', 'Deporte', 'USA', true, 55, 72, '{"seed":true}'::jsonb),
  ('Google News Texas', 'rss', 'https://news.google.com/rss/search?q=Texas&hl=es-419&gl=US&ceid=US:es-419', 'TX', 'TX', true, 70, 66, '{"seed":true}'::jsonb)
on conflict (name) do update
set
  rss_url = excluded.rss_url,
  category = excluded.category,
  region = excluded.region,
  active = excluded.active,
  priority = excluded.priority,
  trust_score = excluded.trust_score,
  updated_at = now();

insert into public.admin_settings (key, value)
values
  ('viral_demo_mode', '{"enabled":true,"note":"seed default"}'::jsonb)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

with source_pick as (
  select id from public.news_sources order by priority desc nulls last limit 1
),
inserted as (
  insert into public.news_articles (
    source_id,
    title,
    slug,
    source_url,
    original_title,
    original_content,
    rewritten_content,
    summary,
    excerpt,
    author_name,
    category,
    region,
    tags,
    status,
    published_at,
    publish_at,
    trending_score,
    discover_score,
    controversy_score,
    engagement_score,
    seo,
    social
  )
  select
    sp.id,
    'Demo: Puerto Rico enciende el debate en redes',
    'demo-puerto-rico-enciende-el-debate-en-redes',
    'https://example.com/demo-pr-redes',
    'Demo: Puerto Rico enciende el debate en redes',
    'Contenido demo para validar el pipeline viral.',
    'Reescritura demo lista para pruebas de UI y social queue.',
    'Resumen demo: conversación caliente en la isla.',
    'Este artículo demo prueba listados, scoring y publicación automática.',
    'SPM News',
    'PR',
    'PR',
    array['pr','viral','demo'],
    'published',
    now(),
    now(),
    88,
    77,
    60,
    82,
    '{"title":"Demo | SPM News","description":"Demo pipeline viral"}'::jsonb,
    '{"facebook":"Demo post copy"}'::jsonb
  from source_pick sp
  on conflict (slug) do nothing
  returning id
)
insert into public.article_polls (article_id, question, active)
select i.id, '¿Este tema merece cobertura diaria?', true
from inserted i;

insert into public.confessions (title, body, status, level, is_anonymous, category, region, created_at)
values (
  'Demo confesión',
  'Esto es una confesión demo para validar moderación en admin.',
  'pending',
  'public',
  true,
  'sociedad',
  'PR',
  now()
);
