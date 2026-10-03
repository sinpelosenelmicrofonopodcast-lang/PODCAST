create or replace function public.clean_public_news_body(body text)
returns text language sql immutable strict set search_path=pg_catalog as $$
select btrim(regexp_replace(regexp_replace(regexp_replace(body,
'(^|\n)[ \t]*[#*>🔎 ]*(Qué revisar al aprobar|Notas? (internas?|para revisión)|Revisión editorial)[ \t]*:?[ \t]*\n[^\n]*(\n|$)', E'\\1', 'gi'),
'(^|\n)[ \t]*[#*>🔎¿ ]*(Qué pasó( exactamente)?|Qué está pasando|Qué viene( ahora)?|Qué sigue|Qué significa|Qué anunció la agencia|Qué dicen los datos|El estado del brote|El plazo que importa este fin de semana|Lectura Sin Pelos|Análisis Sin Pelos|Contexto caliente)[ \t]*[?:]?[ \t]*(\n|$)', E'\\1', 'gi'),
E'\n{3,}',E'\n\n','g'));
$$;
revoke all on function public.clean_public_news_body(text) from public;
grant execute on function public.clean_public_news_body(text) to service_role;
create or replace function public.clean_public_news_fields()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 new.analysis := public.clean_public_news_body(new.analysis);
 if TG_TABLE_NAME = 'news_articles' then
  new.rewritten_content := public.clean_public_news_body(new.rewritten_content);
 end if;
 return new;
end $$;
revoke all on function public.clean_public_news_fields() from public;
grant execute on function public.clean_public_news_fields() to service_role;
create trigger clean_public_news_fields before insert or update of analysis on public.news_items for each row execute function public.clean_public_news_fields();
create trigger clean_public_news_fields before insert or update of analysis,rewritten_content on public.news_articles for each row execute function public.clean_public_news_fields();
update public.news_items set analysis=public.clean_public_news_body(analysis) where analysis is distinct from public.clean_public_news_body(analysis);
update public.news_articles set analysis=public.clean_public_news_body(analysis),rewritten_content=public.clean_public_news_body(rewritten_content) where analysis is distinct from public.clean_public_news_body(analysis) or rewritten_content is distinct from public.clean_public_news_body(rewritten_content);
