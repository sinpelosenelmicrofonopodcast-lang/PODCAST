-- Add optional Google Drive video link per news item.
alter table if exists public.news_items
  add column if not exists video_url text;

comment on column public.news_items.video_url is
  'Optional Google Drive URL for embedding a video player in news detail.';
