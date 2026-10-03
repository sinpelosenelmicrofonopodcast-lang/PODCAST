alter table public.editorial_bridge_config add column if not exists facebook_cipher text;
alter table public.editorial_drive_drafts add column if not exists facebook_selected boolean not null default false, add column if not exists facebook_caption text not null default '', add column if not exists facebook_approved_hash text;
create table if not exists public.editorial_facebook_deliveries (
 draft_id uuid primary key references public.editorial_drive_drafts(id), snapshot_hash text not null,
 state text not null default 'enviando', remote_id text, post_url text, comment_id text,
 comment_state text not null default 'pendiente', pin_state text not null default 'Pendiente: fijar desde Facebook', detail text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.editorial_facebook_deliveries enable row level security;
revoke all on public.editorial_facebook_deliveries from anon,authenticated;
grant all on public.editorial_facebook_deliveries to service_role;
