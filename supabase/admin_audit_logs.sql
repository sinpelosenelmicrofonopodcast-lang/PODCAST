-- Admin audit log (P0 security/traceability)
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text null,
  target_id text null,
  meta jsonb not null default '{}'::jsonb,
  ip text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs(created_at desc);

create index if not exists admin_audit_logs_actor_idx
  on public.admin_audit_logs(actor_id, created_at desc);

create index if not exists admin_audit_logs_action_idx
  on public.admin_audit_logs(action, created_at desc);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "admin_audit_logs admin read" on public.admin_audit_logs;
create policy "admin_audit_logs admin read"
on public.admin_audit_logs
for select
using (public.is_admin(auth.uid()));

drop policy if exists "admin_audit_logs admin write" on public.admin_audit_logs;
create policy "admin_audit_logs admin write"
on public.admin_audit_logs
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
