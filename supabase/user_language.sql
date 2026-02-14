-- Persist selected UI language per user profile
alter table public.users
add column if not exists preferred_language text not null default 'es';

