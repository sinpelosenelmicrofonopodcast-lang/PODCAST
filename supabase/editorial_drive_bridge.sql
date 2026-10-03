create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.editorial_bridge_config (
 id boolean primary key default true check(id),
 key_hash text not null,
 owner_id text,
 google_cipher text,
 spreadsheet_id text,
 sheet_id integer,
 enabled boolean not null default false,
 last_sync timestamptz,
 last_error text,
 lock_until timestamptz
);
alter table public.editorial_bridge_config enable row level security;
revoke all on public.editorial_bridge_config from anon, authenticated;
grant all on public.editorial_bridge_config to service_role;

create table if not exists public.editorial_drive_drafts (
 id uuid primary key,
 payload jsonb not null,
 content_hash text not null,
 status text not null default 'En revisión',
 revision integer not null default 1,
 published_hash text,
 published_at timestamptz,
 article_id uuid,
 public_url text,
 last_error text,
 updated_at timestamptz not null default now()
);
alter table public.editorial_drive_drafts enable row level security;
revoke all on public.editorial_drive_drafts from anon, authenticated;
grant all on public.editorial_drive_drafts to service_role;

create table if not exists public.editorial_drive_audit (
 id bigint generated always as identity primary key,
 draft_id uuid,
 action text not null,
 actor text not null,
 revision integer,
 created_at timestamptz not null default now()
);
alter table public.editorial_drive_audit enable row level security;
revoke all on public.editorial_drive_audit from anon, authenticated;
grant all on public.editorial_drive_audit to service_role;
grant usage,select on sequence public.editorial_drive_audit_id_seq to service_role;

create or replace function public.publish_editorial_drive(p_id uuid,p_hash text,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare d public.editorial_drive_drafts; a uuid; n uuid; s text; ts timestamptz;
begin
 select * into d from editorial_drive_drafts where id=p_id for update;
 if not found then raise exception 'Borrador no encontrado'; end if;
 if d.content_hash<>p_hash then raise exception 'El contenido cambió; revisa de nuevo'; end if;
 if d.published_hash=p_hash then return jsonb_build_object('url',d.public_url,'duplicate',true); end if;
 if d.status<>'Aprobado' then raise exception 'Falta aprobación'; end if;
 if nullif(d.payload->>'scheduledAt','') is not null and (d.payload->>'scheduledAt')::timestamptz>now() then
   return jsonb_build_object('scheduled',true);
 end if;
 a:=coalesce(d.article_id,p_id);
 select id,legacy_news_item_id,slug,published_at into a,n,s,ts from news_articles where source_url=d.payload->>'sourceUrl';
 a:=coalesce(a,d.article_id,p_id); n:=coalesce(n,a);
 s:=coalesce(s,'editorial-'||a::text); ts:=coalesce(ts,now());
 insert into news_items(id,slug,title,summary,analysis,source_url,cover_url,categories,publication_state,published_at,needs_review)
 values(n,s,d.payload->>'title',d.payload->>'summary',d.payload->>'body',d.payload->>'sourceUrl',nullif(d.payload->>'imageUrl',''),array[d.payload->>'category',d.payload->>'region'],'published',ts,false)
 on conflict(id) do update set title=excluded.title,summary=excluded.summary,analysis=excluded.analysis,source_url=excluded.source_url,cover_url=excluded.cover_url,categories=excluded.categories,publication_state='published',needs_review=false,updated_at=now();
 insert into news_articles(id,legacy_news_item_id,slug,title,summary,excerpt,analysis,rewritten_content,source_url,source_name,category,region,cover_image_url,status,published_at,publish_at,author_name)
 values(a,n,s,d.payload->>'title',d.payload->>'summary',d.payload->>'summary',d.payload->>'body',d.payload->>'body',d.payload->>'sourceUrl',d.payload->>'sourceName',d.payload->>'category',d.payload->>'region',nullif(d.payload->>'imageUrl',''),'published',ts,ts,'Sin Pelos en el Micrófono')
 on conflict(id) do update set title=excluded.title,summary=excluded.summary,excerpt=excluded.excerpt,analysis=excluded.analysis,rewritten_content=excluded.rewritten_content,source_name=excluded.source_name,category=excluded.category,region=excluded.region,cover_image_url=excluded.cover_image_url,status='published',updated_at=now();
 update editorial_drive_drafts set published_hash=p_hash,published_at=now(),article_id=a,status='Publicado',public_url='https://www.sinpelosenelmicrofono.com/noticias/'||s,last_error=null where id=p_id;
 insert into editorial_drive_audit(draft_id,action,actor,revision) values(p_id,'Publicado',p_actor,d.revision);
 return jsonb_build_object('url','https://www.sinpelosenelmicrofono.com/noticias/'||s,'articleId',a);
end $$;
revoke all on function public.publish_editorial_drive(uuid,text,text) from public,anon,authenticated;
grant execute on function public.publish_editorial_drive(uuid,text,text) to service_role;
