-- Phase 1 sponsorship lead pipeline; applied 2026-10-08.
alter table public.ad_requests add column if not exists lead_source text;
alter table public.ad_requests add column if not exists utm_campaign text;
alter table public.ad_requests add column if not exists internal_notes text;
alter table public.ad_requests add column if not exists next_follow_up_at timestamptz;
alter table public.ad_requests drop constraint if exists ad_requests_status_check;
alter table public.ad_requests add constraint ad_requests_status_check check (status in ('new','contacted','proposal','won','lost','closed'));
create index if not exists ad_requests_follow_up_idx on public.ad_requests(next_follow_up_at) where next_follow_up_at is not null;
