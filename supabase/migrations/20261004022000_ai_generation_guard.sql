create table if not exists public.ai_generation_cache (
 cache_key text primary key,
 response jsonb,
 expires_at timestamptz,
 lease_token uuid,
 lease_until timestamptz
);
alter table public.ai_generation_cache enable row level security;
revoke all on public.ai_generation_cache from anon,authenticated;
grant all on public.ai_generation_cache to service_role;
create or replace function public.claim_ai_generation(p_key text) returns uuid
language plpgsql security definer set search_path=public as $$
declare token uuid:=gen_random_uuid(); today date:=(now() at time zone 'America/Chicago')::date;
begin
 insert into ai_generation_cache(cache_key) values(p_key) on conflict do nothing;
 update ai_generation_cache set lease_token=token,lease_until=now()+interval '3 minutes'
 where cache_key=p_key and (lease_until is null or lease_until<=now());
 if not found then return null; end if;
 insert into integration_sync_state(provider) values('news_ai') on conflict do nothing;
 update integration_sync_state set quota_day=today,
 reserved_units=case when quota_day=today then reserved_units+1 else 1 end
 where provider='news_ai' and next_allowed_at<=now() and (quota_day<>today or reserved_units<60);
 if not found then update ai_generation_cache set lease_token=null,lease_until=null where cache_key=p_key and lease_token=token;return null;end if;
 return token;
end $$;
create or replace function public.finish_ai_generation(p_key text,p_token uuid,p_response jsonb default null,p_pause_seconds integer default 0)
returns void language plpgsql security definer set search_path=public as $$
begin
 update ai_generation_cache set response=coalesce(p_response,response),
 expires_at=case when p_response is null then expires_at else now()+interval '24 hours' end,
 lease_token=null,lease_until=null where cache_key=p_key and lease_token=p_token;
 if not found then return;end if;
 update integration_sync_state set next_allowed_at=greatest(next_allowed_at,now()+make_interval(secs=>greatest(0,least(p_pause_seconds,86400)))),
 health=case when p_pause_seconds>0 then 'degraded_quota' when p_response is null then 'degraded_provider' else 'ok' end,
 last_success_at=case when p_response is null then last_success_at else now() end,
 last_error=case when p_pause_seconds>0 then 'Provider quota/rate limit; no automatic retries' else null end where provider='news_ai';
end $$;
revoke all on function public.claim_ai_generation(text) from public,anon,authenticated;
revoke all on function public.finish_ai_generation(text,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.claim_ai_generation(text) to service_role;
grant execute on function public.finish_ai_generation(text,uuid,jsonb,integer) to service_role;
