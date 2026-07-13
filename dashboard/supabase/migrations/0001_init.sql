-- Prompt Tracker — schéma complet, extrait de la base source coach-ia
-- (myvrkgurplqbrjzcuzwg) pour recâblage vers un nouveau projet Supabase.
-- Idempotent autant que possible. Ordre : extensions → enums → tables →
-- contraintes → index → fonctions → triggers → RLS → policies → grants.
-- Les utilisateurs auth ne sont PAS migrés ici (voir seed + doc de bascule).

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- Types énumérés
do $$ begin
  create type public.capture_mode as enum ('metadata', 'full');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.user_role as enum ('admin', 'member');
exception when duplicate_object then null; end $$;

-- Tables
create table if not exists public.organizations (
  id uuid not null default gen_random_uuid(),
  name text not null,
  brand_name text,
  brand_color text not null default '#6d5bd0'::text,
  logo_url text,
  threshold integer not null default 40,
  capture_mode public.capture_mode not null default 'metadata'::public.capture_mode,
  llm_enabled boolean not null default false,
  intercept_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid not null,
  org_id uuid,
  role public.user_role not null default 'member'::public.user_role,
  email text,
  display_name text,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null,
  user_id uuid not null
);

create table if not exists public.prompt_events (
  id uuid not null default gen_random_uuid(),
  client_event_id text not null,
  user_id uuid not null,
  org_id uuid not null,
  ts timestamptz not null,
  site text not null,
  category text,
  words integer,
  scores jsonb not null,
  intercepted boolean not null default false,
  outcome text,
  score_before integer,
  score_after integer,
  mirror_shown boolean not null default false,
  mirror_feedback text,
  text text,
  created_at timestamptz not null default now(),
  rounds integer not null default 0,
  answers_count integer not null default 0
);

create table if not exists public.socratic_templates (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  key text not null,
  question text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Contraintes (clés primaires, étrangères, uniques, checks)
do $$ begin
  alter table public.organizations add constraint organizations_pkey primary key (id);
  alter table public.organizations add constraint organizations_threshold_check check (threshold >= 0 and threshold <= 100);

  alter table public.profiles add constraint profiles_pkey primary key (id);
  alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
  alter table public.profiles add constraint profiles_org_id_fkey foreign key (org_id) references public.organizations(id) on delete set null;

  alter table public.groups add constraint groups_pkey primary key (id);
  alter table public.groups add constraint groups_org_id_fkey foreign key (org_id) references public.organizations(id) on delete cascade;

  alter table public.group_members add constraint group_members_pkey primary key (group_id, user_id);
  alter table public.group_members add constraint group_members_group_id_fkey foreign key (group_id) references public.groups(id) on delete cascade;
  alter table public.group_members add constraint group_members_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

  alter table public.prompt_events add constraint prompt_events_pkey primary key (id);
  alter table public.prompt_events add constraint prompt_events_user_id_client_event_id_key unique (user_id, client_event_id);
  alter table public.prompt_events add constraint prompt_events_outcome_check check (outcome = any (array['sent','improved','sent_anyway','cancelled']));
  alter table public.prompt_events add constraint prompt_events_org_id_fkey foreign key (org_id) references public.organizations(id) on delete cascade;
  alter table public.prompt_events add constraint prompt_events_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

  alter table public.socratic_templates add constraint socratic_templates_pkey primary key (id);
  alter table public.socratic_templates add constraint socratic_templates_org_id_key_key unique (org_id, key);
  alter table public.socratic_templates add constraint socratic_templates_org_id_fkey foreign key (org_id) references public.organizations(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- Index
create index if not exists prompt_events_org_ts on public.prompt_events using btree (org_id, ts desc);
create index if not exists prompt_events_user_ts on public.prompt_events using btree (user_id, ts desc);

-- Fonctions
create or replace function public.auth_is_admin()
  returns boolean language sql stable security definer set search_path to 'public'
as $$ select coalesce((select role = 'admin' and not disabled from public.profiles where id = auth.uid()), false) $$;

create or replace function public.auth_org_id()
  returns uuid language sql stable security definer set search_path to 'public'
as $$ select org_id from public.profiles where id = auth.uid() $$;

create or replace function public.enforce_capture_mode()
  returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if (select capture_mode from public.organizations where id = new.org_id) = 'metadata' then
    new.text := null;
  end if;
  return new;
end $$;

create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end $$;

-- Triggers
drop trigger if exists enforce_capture_mode on public.prompt_events;
create trigger enforce_capture_mode before insert on public.prompt_events
  for each row execute function public.enforce_capture_mode();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.prompt_events enable row level security;
alter table public.socratic_templates enable row level security;

-- Policies
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select to public using (id = public.auth_org_id());
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update to public using (id = public.auth_org_id() and public.auth_is_admin());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to public using (id = auth.uid() or (public.auth_is_admin() and org_id = public.auth_org_id()));
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to public using (public.auth_is_admin() and (org_id = public.auth_org_id() or org_id is null));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to public using (id = auth.uid()) with check (id = auth.uid() and role = 'member'::public.user_role);

drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select to public using (org_id = public.auth_org_id());
drop policy if exists groups_admin on public.groups;
create policy groups_admin on public.groups for all to public using (public.auth_is_admin() and org_id = public.auth_org_id()) with check (public.auth_is_admin() and org_id = public.auth_org_id());

drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members for select to public using (exists (select 1 from public.groups g where g.id = group_members.group_id and g.org_id = public.auth_org_id()));
drop policy if exists group_members_admin on public.group_members;
create policy group_members_admin on public.group_members for all to public using (public.auth_is_admin() and exists (select 1 from public.groups g where g.id = group_members.group_id and g.org_id = public.auth_org_id())) with check (public.auth_is_admin() and exists (select 1 from public.groups g where g.id = group_members.group_id and g.org_id = public.auth_org_id()));

drop policy if exists events_insert on public.prompt_events;
create policy events_insert on public.prompt_events for insert to public with check (user_id = auth.uid() and org_id = public.auth_org_id());
drop policy if exists events_select on public.prompt_events;
create policy events_select on public.prompt_events for select to public using (user_id = auth.uid() or (public.auth_is_admin() and org_id = public.auth_org_id()));

drop policy if exists templates_select on public.socratic_templates;
create policy templates_select on public.socratic_templates for select to public using (org_id = public.auth_org_id());
drop policy if exists templates_admin on public.socratic_templates;
create policy templates_admin on public.socratic_templates for all to public using (public.auth_is_admin() and org_id = public.auth_org_id()) with check (public.auth_is_admin() and org_id = public.auth_org_id());

-- Grants (reproduit les privilèges Supabase par défaut pour les rôles applicatifs)
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
