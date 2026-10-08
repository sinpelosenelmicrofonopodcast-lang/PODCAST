-- Applied in Supabase migration business_inquiry_intake_20261008
-- Public API is server-only; no direct anon SELECT or INSERT privileges.
create table if not exists public.business_inquiries (
 id uuid primary key default gen_random_uuid(),
 inquiry_type text not null check (inquiry_type in ('video','photo_video','interviews','podcast_production','event_coverage','equipment_rental','event_listing','other')),
 full_name text not null check(char_length(full_name) between 2 and 120),
 email text not null check(char_length(email) between 6 and 254),
 phone text,business_name text,event_date date,location text,budget_range text,
 details text not null check(char_length(details) between 10 and 4000),
 source_path text,utm_source text,status text not null default 'new' check(status in ('new','contacted','quoted','booked','closed','lost')),
 staff_notes text,next_follow_up_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.business_inquiries enable row level security;
revoke all on public.business_inquiries from anon,authenticated;
grant all on public.business_inquiries to service_role;
create index if not exists business_inquiries_status_created on public.business_inquiries(status,created_at desc);
create index if not exists business_inquiries_email_created on public.business_inquiries(lower(email),created_at desc);
