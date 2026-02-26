-- Sprint 1: Home editorial controls + trending weights

alter table if exists public.home_settings
  add column if not exists editors_pick_news_ids uuid[] not null default '{}',
  add column if not exists trending_weight_comments numeric(4,3) not null default 0.450,
  add column if not exists trending_weight_shares numeric(4,3) not null default 0.350,
  add column if not exists trending_weight_views numeric(4,3) not null default 0.200;

alter table if exists public.home_settings
  drop constraint if exists home_settings_trending_weight_comments_range;
alter table if exists public.home_settings
  drop constraint if exists home_settings_trending_weight_shares_range;
alter table if exists public.home_settings
  drop constraint if exists home_settings_trending_weight_views_range;
alter table if exists public.home_settings
  drop constraint if exists home_settings_trending_weight_sum_positive;

alter table if exists public.home_settings
  add constraint home_settings_trending_weight_comments_range
    check (trending_weight_comments >= 0 and trending_weight_comments <= 1),
  add constraint home_settings_trending_weight_shares_range
    check (trending_weight_shares >= 0 and trending_weight_shares <= 1),
  add constraint home_settings_trending_weight_views_range
    check (trending_weight_views >= 0 and trending_weight_views <= 1),
  add constraint home_settings_trending_weight_sum_positive
    check ((trending_weight_comments + trending_weight_shares + trending_weight_views) > 0);
