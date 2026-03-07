-- RLS linter performance pass (phase 1)
-- Goals:
-- 1) Fix auth_rls_initplan warnings by wrapping auth/current_setting calls with SELECT.
-- 2) Scope auth-dependent policies to TO authenticated (instead of PUBLIC) when safe.
-- 3) Remove duplicate index warning on blog_posts.

do $$
declare
  p record;
  roles_new name[];
  roles_sql text;
  cmd_sql text;
  qual_new text;
  with_check_new text;
  create_sql text;
begin
  for p in
    select
      schemaname,
      tablename,
      policyname,
      permissive,
      cmd,
      roles,
      qual,
      with_check
    from pg_policies
    where schemaname = 'public'
  loop
    roles_new := p.roles;
    qual_new := p.qual;
    with_check_new := p.with_check;

    -- Fix initplan warnings: wrap auth/current_setting function calls.
    if qual_new is not null then
      qual_new := replace(qual_new, 'auth.uid()', '(select auth.uid())');
      qual_new := replace(qual_new, 'auth.role()', '(select auth.role())');
      qual_new := replace(qual_new, 'auth.jwt()', '(select auth.jwt())');
      qual_new := replace(qual_new, 'current_setting(', '(select current_setting(');
      qual_new := replace(qual_new, '(select (select current_setting(', '(select current_setting(');
    end if;

    if with_check_new is not null then
      with_check_new := replace(with_check_new, 'auth.uid()', '(select auth.uid())');
      with_check_new := replace(with_check_new, 'auth.role()', '(select auth.role())');
      with_check_new := replace(with_check_new, 'auth.jwt()', '(select auth.jwt())');
      with_check_new := replace(with_check_new, 'current_setting(', '(select current_setting(');
      with_check_new := replace(with_check_new, '(select (select current_setting(', '(select current_setting(');
    end if;

    -- If policy depends on auth/session state and is PUBLIC, scope it to authenticated.
    if 'public' = any(p.roles)
       and (
         coalesce(p.qual, '') ~ 'auth\.(uid|role|jwt)\('
         or coalesce(p.with_check, '') ~ 'auth\.(uid|role|jwt)\('
         or coalesce(p.qual, '') ~ 'current_setting\('
         or coalesce(p.with_check, '') ~ 'current_setting\('
         or coalesce(p.qual, '') ~ 'public\.is_admin\('
         or coalesce(p.with_check, '') ~ 'public\.is_admin\('
       )
    then
      roles_new := array['authenticated']::name[];
    end if;

    -- Recreate only when something changed.
    if roles_new is not distinct from p.roles
       and qual_new is not distinct from p.qual
       and with_check_new is not distinct from p.with_check
    then
      continue;
    end if;

    select string_agg(
      case
        when r::text = 'public' then 'public'
        else quote_ident(r::text)
      end,
      ', '
      order by ord
    )
    into roles_sql
    from unnest(roles_new) with ordinality as role_list(r, ord);

    if roles_sql is null then
      roles_sql := 'public';
    end if;

    cmd_sql := case p.cmd
      when 'ALL' then 'all'
      when 'SELECT' then 'select'
      when 'INSERT' then 'insert'
      when 'UPDATE' then 'update'
      when 'DELETE' then 'delete'
      else lower(p.cmd)
    end;

    create_sql := format(
      'create policy %I on %I.%I as %s for %s to %s',
      p.policyname,
      p.schemaname,
      p.tablename,
      p.permissive,
      cmd_sql,
      roles_sql
    );

    if qual_new is not null then
      create_sql := create_sql || format(' using (%s)', qual_new);
    end if;

    if with_check_new is not null then
      create_sql := create_sql || format(' with check (%s)', with_check_new);
    end if;

    execute format(
      'drop policy %I on %I.%I',
      p.policyname,
      p.schemaname,
      p.tablename
    );

    execute create_sql;
  end loop;
end
$$;

-- Duplicate index cleanup.
drop index if exists public.blog_posts_created_at_base_idx;
