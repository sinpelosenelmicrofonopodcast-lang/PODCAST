begin;

create table if not exists public.social_comment_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  platform text not null check (platform in ('facebook', 'instagram')),
  comment_id text not null,
  parent_comment_id text,
  post_id text,
  media_id text,
  sender_id text,
  sender_name text,
  message text not null,
  decision text,
  matched_rule text,
  reply_attempted boolean not null default false,
  reply_sent boolean not null default false,
  reply_comment_id text,
  reply_message text,
  error text,
  raw jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_comment_events_platform_created_idx
  on public.social_comment_events (platform, created_at desc);

create index if not exists social_comment_events_sender_idx
  on public.social_comment_events (platform, sender_id, created_at desc);

create index if not exists social_comment_events_comment_idx
  on public.social_comment_events (platform, comment_id);

create or replace function public.social_comment_events_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_social_comment_events_set_updated_at on public.social_comment_events;
create trigger trg_social_comment_events_set_updated_at
before update on public.social_comment_events
for each row
execute function public.social_comment_events_set_updated_at();

alter table public.social_comment_events enable row level security;

drop policy if exists "social_comment_events admin all" on public.social_comment_events;
create policy "social_comment_events admin all"
on public.social_comment_events
for all
using (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = 'admin'
  )
);

insert into public.admin_settings (key, value)
values (
  'social_auto_reply',
  '{
    "enabled": false,
    "facebookEnabled": true,
    "instagramEnabled": false,
    "authorCooldownHours": 24,
    "maxCommentLength": 280,
    "blockedKeywords": ["odio", "mierda", "basura", "estafa", "fraude", "cabron", "pendej", "fuck", "scam"],
    "youtubeUrl": "https://www.youtube.com/@SinPelosEnElMicrofono",
    "rules": [
      {
        "id": "youtube_follow",
        "label": "Seguir en YouTube",
        "enabled": true,
        "platforms": ["facebook", "instagram"],
        "keywords": ["youtube", "canal", "suscrib", "subscribe", "follow", "seguir"],
        "replyTemplate": "Te dejamos el canal por aqui: {youtubeUrl} Si no nos sigues todavia, date la vuelta."
      },
      {
        "id": "watch_link",
        "label": "Donde verlo",
        "enabled": true,
        "platforms": ["facebook", "instagram"],
        "keywords": ["link", "donde", "ver", "veo", "episodio", "capitulo"],
        "replyTemplate": "Puedes ver los episodios y seguirnos por aqui: {youtubeUrl}"
      }
    ]
  }'::jsonb
)
on conflict (key) do nothing;

select pg_notify('pgrst', 'reload schema');

commit;
