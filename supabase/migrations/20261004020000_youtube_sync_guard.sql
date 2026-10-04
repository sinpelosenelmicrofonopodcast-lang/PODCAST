-- Durable, service-only coordination across cron/manual requests and instances.
create table if not exists public.integration_sync_state (
 provider text primary key,
 quota_day date not null default (now() at time zone 'America/Los_Angeles')::date,
 reserved_units integer not null default 0,
 lease_token uuid,
 lease_until timestamptz,
 next_allowed_at timestamptz not null default now(),
 last_success_at timestamptz,
 last_error text,
 health text not null default 'unknown'
);
alter table public.integration_sync_state enable row level security;
revoke all on public.integration_sync_state from anon, authenticated;
grant all on public.integration_sync_state to service_role;
create or replace function public.claim_youtube_sync() returns uuid
language plpgsql security definer set search_path=public as $$
declare token uuid:=gen_random_uuid(); today date:=(now() at time zone 'America/Los_Angeles')::date;
begin
 insert into integration_sync_state(provider) values('youtube') on conflict do nothing;
 update integration_sync_state set
 reserved_units=case when quota_day=today then reserved_units+3 else 3 end,
 quota_day=today,lease_token=token,lease_until=now()+interval '5 minutes',
 next_allowed_at=now()+interval '6 hours'
 where provider='youtube' and next_allowed_at<=now()
 and (lease_until is null or lease_until<=now())
 and (quota_day<>today or reserved_units+3<=12);
 if found then return token; end if;
 return null;
end $$;
create or replace function public.finish_youtube_sync(p_token uuid,p_error text default null,p_quota boolean default false)
returns void language plpgsql security definer set search_path=public as $$
begin
 update integration_sync_state set
 lease_until=null,lease_token=null,
 health=case when p_quota then 'degraded_quota' when p_error is not null then 'degraded_provider' else 'ok' end,
 last_error=p_error,
 last_success_at=case when p_error is null then now() else last_success_at end,
 next_allowed_at=case when p_quota then
 ((now() at time zone 'America/Los_Angeles')::date+1)::timestamp at time zone 'America/Los_Angeles'
 when p_error is not null then greatest(next_allowed_at,now()+interval '1 hour') else next_allowed_at end
 where provider='youtube' and lease_token=p_token;
end $$;
revoke all on function public.claim_youtube_sync() from public,anon,authenticated;
revoke all on function public.finish_youtube_sync(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_youtube_sync() to service_role;
grant execute on function public.finish_youtube_sync(uuid,text,boolean) to service_role;
