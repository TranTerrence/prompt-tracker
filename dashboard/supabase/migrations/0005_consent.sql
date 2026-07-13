-- Consentement hybride : l'org déclare le MAXIMUM qu'elle demande par catégorie
-- (avec un « pourquoi » affiché à l'étudiant), l'étudiant consent en dessous,
-- révocable, journalisé. Principe clé : ce qui n'est pas demandé ET consenti
-- n'est JAMAIS stocké (nullifié à l'insert) — la RLS n'a rien à filtrer et la
-- purge sur révocation est un simple update.
-- Les indicateurs/scores ne sont PAS une catégorie : socle toujours collecté,
-- affiché comme tel dans l'UI de consentement.

do $$ begin
  create type public.consent_category as enum
    ('prompt_text', 'socratic_dialogue', 'post_reflection', 'conversation_history');
exception when duplicate_object then null; end $$;

-- Ce que l'organisation demande
create table if not exists public.org_data_requests (
  org_id uuid not null references public.organizations(id) on delete cascade,
  category public.consent_category not null,
  requested boolean not null default false,
  purpose text,
  updated_at timestamptz not null default now(),
  primary key (org_id, category)
);

-- Ce que l'utilisateur accorde (état courant)
create table if not exists public.consents (
  user_id uuid not null references public.profiles(id) on delete cascade,
  category public.consent_category not null,
  granted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

-- Journal append-only (traçabilité RGPD), alimenté par trigger
create table if not exists public.consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  category public.consent_category not null,
  granted boolean not null,
  created_at timestamptz not null default now()
);

create or replace function public.log_consent()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.granted is distinct from old.granted then
    insert into public.consent_log (user_id, category, granted)
      values (new.user_id, new.category, new.granted);
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke execute on function public.log_consent() from anon, authenticated;

drop trigger if exists log_consent on public.consents;
create trigger log_consent before insert or update on public.consents
  for each row execute function public.log_consent();

-- Capture effective = demandé par l'org ET consenti par l'utilisateur
create or replace function public.effective_capture(p_org uuid, p_user uuid, p_cat public.consent_category)
  returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((select requested from public.org_data_requests
                   where org_id = p_org and category = p_cat), false)
     and coalesce((select granted from public.consents
                   where user_id = p_user and category = p_cat), false)
$$;

-- Contenu riche sur les événements : dialogue socratique + clé de conversation
alter table public.prompt_events
  add column if not exists dialogue jsonb,
  add column if not exists conv_key text;

create index if not exists prompt_events_user_conv
  on public.prompt_events (user_id, conv_key) where conv_key is not null;

-- enforce_consent remplace enforce_capture_mode : défense en profondeur
-- (l'extension applique déjà la minimisation à la source).
create or replace function public.enforce_consent()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not public.effective_capture(new.org_id, new.user_id, 'prompt_text') then
    new.text := null;
  end if;
  if not public.effective_capture(new.org_id, new.user_id, 'socratic_dialogue') then
    new.dialogue := null;
  end if;
  if not public.effective_capture(new.org_id, new.user_id, 'conversation_history') then
    new.conv_key := null;
  end if;
  return new;
end $$;
revoke execute on function public.enforce_consent() from anon, authenticated;

drop trigger if exists enforce_capture_mode on public.prompt_events;
drop trigger if exists enforce_consent on public.prompt_events;
create trigger enforce_consent before insert on public.prompt_events
  for each row execute function public.enforce_consent();
drop function if exists public.enforce_capture_mode();

-- RLS
alter table public.org_data_requests enable row level security;
alter table public.consents enable row level security;
alter table public.consent_log enable row level security;

-- Les demandes de l'org sont visibles de tous ses membres (l'extension les
-- affiche à l'adhésion) ; seuls les admins les modifient.
drop policy if exists odr_select on public.org_data_requests;
create policy odr_select on public.org_data_requests for select
  using (org_id = public.auth_org_id());
drop policy if exists odr_admin on public.org_data_requests;
create policy odr_admin on public.org_data_requests for all
  using (public.auth_is_admin() and org_id = public.auth_org_id())
  with check (public.auth_is_admin() and org_id = public.auth_org_id());

-- Chacun gère ses consentements ; l'admin de l'org les LIT (badges UI).
drop policy if exists consents_own on public.consents;
create policy consents_own on public.consents for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists consents_read_admin on public.consents;
create policy consents_read_admin on public.consents for select
  using (public.auth_is_admin() and exists (
    select 1 from public.profiles p
    where p.id = consents.user_id and p.org_id = public.auth_org_id()));

-- Journal : lecture par l'intéressé et l'admin de son org ; écriture par trigger.
drop policy if exists consent_log_select on public.consent_log;
create policy consent_log_select on public.consent_log for select
  using (user_id = auth.uid() or (public.auth_is_admin() and exists (
    select 1 from public.profiles p
    where p.id = consent_log.user_id and p.org_id = public.auth_org_id())));

-- Backfill : traduire capture_mode en demande d'org. Aucun consentement
-- utilisateur présumé (défaut refus) : la capture de texte reprend quand
-- chaque utilisateur a consenti explicitement.
insert into public.org_data_requests (org_id, category, requested)
select o.id, c.cat, (o.capture_mode = 'full' and c.cat = 'prompt_text')
from public.organizations o
cross join (select unnest(enum_range(null::public.consent_category)) as cat) c
on conflict (org_id, category) do nothing;
