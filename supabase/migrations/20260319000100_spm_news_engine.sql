begin;

alter table if exists public.news_articles
  add column if not exists source_name text,
  add column if not exists analysis text,
  add column if not exists hashtags text[] not null default '{}'::text[],
  add column if not exists impact_score numeric not null default 0;

update public.news_articles
set
  source_name = coalesce(source_name, ai_metadata->>'source'),
  analysis = coalesce(analysis, rewritten_content, original_content, summary),
  hashtags = case
    when hashtags is null then '{}'::text[]
    else hashtags
  end,
  impact_score = coalesce(impact_score, discover_score, 0)
where true;

create index if not exists idx_news_articles_status_impact_created_desc
  on public.news_articles (status, impact_score desc, created_at desc);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'news_sources_type_check'
      and conrelid = 'public.news_sources'::regclass
  ) then
    alter table public.news_sources drop constraint news_sources_type_check;
  end if;

  alter table public.news_sources
    add constraint news_sources_type_check
    check (type in ('rss', 'api', 'trend', 'manual', 'google_news', 'reddit'));
end$$;

create temp table tmp_spm_news_sources (
  name text,
  type text,
  rss_url text,
  api_url text,
  category text,
  region text,
  default_categories text[],
  active boolean,
  is_active boolean,
  auto_publish boolean,
  auto_post_facebook boolean,
  priority integer,
  max_items_per_run integer,
  trust_score integer,
  meta jsonb
) on commit drop;

insert into tmp_spm_news_sources (
  name,
  type,
  rss_url,
  api_url,
  category,
  region,
  default_categories,
  active,
  is_active,
  auto_publish,
  auto_post_facebook,
  priority,
  max_items_per_run,
  trust_score,
  meta
)
values
  ('CNN', 'rss', 'https://rss.cnn.com/rss/cnn_topstories.rss', null, 'USA', 'USA', array['USA'], true, true, false, false, 84, 10, 76, '{"sourceKind":"rss"}'::jsonb),
  ('BBC', 'rss', 'https://feeds.bbci.co.uk/news/rss.xml', null, 'Mundo', 'Mundo', array['Mundo'], true, true, false, false, 78, 10, 80, '{"sourceKind":"rss"}'::jsonb),
  ('NYTimes', 'rss', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', null, 'USA', 'USA', array['USA'], true, true, false, false, 80, 10, 82, '{"sourceKind":"rss"}'::jsonb),
  ('Fox News', 'rss', 'https://moxie.foxnews.com/google-publisher/latest.xml', null, 'USA', 'USA', array['USA'], true, true, false, false, 74, 10, 68, '{"sourceKind":"rss"}'::jsonb),
  ('Telemundo', 'google_news', 'https://news.google.com/rss/search?q=site%3Atelemundo.com%2Fnoticias&hl=es-419&gl=US&ceid=US%3Aes-419', 'telemundo.com/noticias', 'USA', 'USA', array['USA','Latino'], true, true, false, false, 77, 8, 72, '{"sourceKind":"google_news","query":"site:telemundo.com/noticias"}'::jsonb),
  ('Univision', 'google_news', 'https://news.google.com/rss/search?q=site%3Aunivision.com%2Fnoticias&hl=es-419&gl=US&ceid=US%3Aes-419', 'univision.com/noticias', 'USA', 'USA', array['USA','Latino'], true, true, false, false, 77, 8, 72, '{"sourceKind":"google_news","query":"site:univision.com/noticias"}'::jsonb),
  ('AP News', 'google_news', 'https://news.google.com/rss/search?q=site%3Aapnews.com&hl=en-US&gl=US&ceid=US%3Aen', 'apnews.com', 'USA', 'USA', array['USA'], true, true, false, false, 82, 10, 84, '{"sourceKind":"google_news","query":"site:apnews.com"}'::jsonb),
  ('Google News Puerto Rico', 'google_news', 'https://news.google.com/rss/search?q=Puerto+Rico&hl=es-419&gl=PR&ceid=PR:es-419', 'Puerto Rico', 'PR', 'PR', array['PR'], true, true, false, false, 92, 10, 65, '{"sourceKind":"google_news","query":"Puerto Rico"}'::jsonb),
  ('Google News Texas', 'google_news', 'https://news.google.com/rss/search?q=Texas&hl=en-US&gl=US&ceid=US:en', 'Texas', 'TX', 'TX', array['TX'], true, true, false, false, 88, 10, 63, '{"sourceKind":"google_news","query":"Texas"}'::jsonb),
  ('Google News USA Breaking', 'google_news', 'https://news.google.com/rss/search?q=USA+breaking&hl=en-US&gl=US&ceid=US:en', 'USA breaking', 'USA', 'USA', array['USA'], true, true, false, false, 86, 10, 62, '{"sourceKind":"google_news","query":"USA breaking"}'::jsonb),
  ('Google News Crime', 'google_news', 'https://news.google.com/rss/search?q=crime&hl=en-US&gl=US&ceid=US:en', 'crime', 'Crimen', 'USA', array['Crimen','USA'], true, true, false, false, 85, 10, 60, '{"sourceKind":"google_news","query":"crime"}'::jsonb),
  ('Google News Politics', 'google_news', 'https://news.google.com/rss/search?q=politics&hl=en-US&gl=US&ceid=US:en', 'politics', 'Politica', 'USA', array['Politica','USA'], true, true, false, false, 85, 10, 60, '{"sourceKind":"google_news","query":"politics"}'::jsonb),
  ('Google News Viral', 'google_news', 'https://news.google.com/rss/search?q=viral&hl=es-419&gl=US&ceid=US:es-419', 'viral', 'USA', 'USA', array['USA'], true, true, false, false, 82, 8, 55, '{"sourceKind":"google_news","query":"viral"}'::jsonb),
  ('Google News Latino', 'google_news', 'https://news.google.com/rss/search?q=latino&hl=es-419&gl=US&ceid=US:es-419', 'latino', 'USA', 'USA', array['USA','Latino'], true, true, false, false, 84, 8, 58, '{"sourceKind":"google_news","query":"latino"}'::jsonb),
  ('Reddit r/news', 'reddit', 'https://www.reddit.com/r/news/.json?limit=20&raw_json=1', 'r/news', 'USA', 'USA', array['USA'], false, false, false, false, 58, 8, 42, '{"sourceKind":"reddit","subreddit":"news"}'::jsonb),
  ('Reddit r/worldnews', 'reddit', 'https://www.reddit.com/r/worldnews/.json?limit=20&raw_json=1', 'r/worldnews', 'Mundo', 'Mundo', array['Mundo'], false, false, false, false, 55, 8, 40, '{"sourceKind":"reddit","subreddit":"worldnews"}'::jsonb);

update public.news_sources ns
set
  name = src.name,
  type = src.type,
  rss_url = src.rss_url,
  api_url = src.api_url,
  category = src.category,
  region = src.region,
  default_categories = src.default_categories,
  active = src.active,
  is_active = src.is_active,
  auto_publish = src.auto_publish,
  auto_post_facebook = src.auto_post_facebook,
  priority = src.priority,
  max_items_per_run = src.max_items_per_run,
  trust_score = src.trust_score,
  meta = src.meta,
  updated_at = now()
from tmp_spm_news_sources src
where ns.name = src.name
   or ns.rss_url = src.rss_url;

insert into public.news_sources (
  name,
  type,
  rss_url,
  api_url,
  category,
  region,
  default_categories,
  active,
  is_active,
  auto_publish,
  auto_post_facebook,
  priority,
  max_items_per_run,
  trust_score,
  meta
)
select
  src.name,
  src.type,
  src.rss_url,
  src.api_url,
  src.category,
  src.region,
  src.default_categories,
  src.active,
  src.is_active,
  src.auto_publish,
  src.auto_post_facebook,
  src.priority,
  src.max_items_per_run,
  src.trust_score,
  src.meta
from tmp_spm_news_sources src
where not exists (
  select 1
  from public.news_sources ns
  where ns.name = src.name
     or ns.rss_url = src.rss_url
);

drop view if exists public.news_posts;
create view public.news_posts as
select
  a.id,
  a.title,
  a.summary,
  coalesce(a.analysis, a.rewritten_content, a.original_content, a.summary) as analysis,
  a.source_url,
  coalesce(a.source_name, s.name, a.ai_metadata->>'source') as source_name,
  a.cover_image_url as image_url,
  a.tags,
  a.hashtags,
  a.category,
  a.status,
  a.created_at
from public.news_articles a
left join public.news_sources s on s.id = a.source_id;

commit;
