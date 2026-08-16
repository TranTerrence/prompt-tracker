-- Le consentement socle (« je rejoins et je partage ces indicateurs ») passe du
-- navigateur à la base.
--
-- Défaut corrigé : ce consentement vivait dans chrome.storage.local
-- (`baselineConsent`), écrit à un SEUL endroit — le handler de jonction du
-- popup. Un étudiant qui rejoignait sa classe sur le web (parcours documenté
-- par /install) ne l'obtenait jamais : syncEvents refusait de pousser, en
-- silence, pour toujours. C'est un fait juridique d'organisation, pas un
-- réglage local : tant qu'il vit dans le navigateur, un nouveau chemin
-- l'oubliera (nouveau poste, profil réinitialisé, Safari, réinstallation).
--
-- Ici : une colonne sur profiles, écrite uniquement par les RPC de jonction
-- (sous le GUC app.allow_org_change), lue par l'extension via refreshOrgConfig.

-- ---------------------------------------------------------------------------
-- 1. Limiteur de débit générique
-- ---------------------------------------------------------------------------
-- api_rate_limits (0008) est typée uuid et réservée aux clés API. Le résolveur
-- public de code et la jonction ont besoin d'un compteur à clé textuelle
-- (hash d'IP, uid, adresse e-mail).

create table if not exists public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);
alter table public.rate_limits enable row level security;
-- Aucune policy : RLS bloque anon/authenticated. Seules les fonctions
-- security definer y touchent.

create or replace function public.rate_hit(
  p_bucket text,
  p_limit integer default 10,
  p_window interval default '1 minute'
) returns boolean language plpgsql volatile security definer set search_path = public
as $$
declare
  secs double precision := extract(epoch from p_window);
  win timestamptz := to_timestamp(floor(extract(epoch from now()) / secs) * secs);
  c integer;
begin
  insert into public.rate_limits (bucket, window_start, count)
    values (p_bucket, win, 1)
  on conflict (bucket, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into c;
  -- Ménage opportuniste, comme api_hit.
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return c <= p_limit;
end $$;
revoke execute on function public.rate_hit(text, integer, interval)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. La colonne
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists baseline_consent_at timestamptz,
  add column if not exists baseline_consent_version integer;

comment on column public.profiles.baseline_consent_at is
  'Instant où l''utilisateur a accepté de partager le socle d''indicateurs avec son organisation. NULL = rien ne doit remonter.';

-- Le verrou de 0004 doit couvrir ces colonnes, sinon profiles_update_own laisse
-- un membre se forger lui-même sa preuve de consentement.
create or replace function public.protect_profile_fields()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(current_setting('app.allow_org_change', true), '') = 'on' then
    return new;
  end if;
  if auth.uid() is null then
    return new; -- service_role / SQL direct : pas une session utilisateur
  end if;
  if public.auth_is_admin() then
    -- Un admin gère les rattachements et les rôles, mais ne consent pas à la
    -- place de quelqu'un d'autre : le socle reste hors de sa portée.
    if new.baseline_consent_at is distinct from old.baseline_consent_at
       or new.baseline_consent_version is distinct from old.baseline_consent_version then
      raise exception 'protected_fields';
    end if;
    return new;
  end if;
  if new.org_id is distinct from old.org_id
     or new.role is distinct from old.role
     or new.disabled is distinct from old.disabled
     or new.baseline_consent_at is distinct from old.baseline_consent_at
     or new.baseline_consent_version is distinct from old.baseline_consent_version then
    raise exception 'protected_fields';
  end if;
  return new;
end $$;
revoke execute on function public.protect_profile_fields() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Résolveur public d'un code de classe (pour /join/<CODE>)
-- ---------------------------------------------------------------------------
-- Appelée par le server component, jamais par le navigateur : p_bucket est un
-- hash d'IP fourni par la route Next (Postgres ne voit pas l'IP de l'appelant).
-- N'expose que de quoi afficher « tu rejoins X chez Y » : aucun identifiant,
-- aucun effectif. Erreur unique et indifférenciée pour ne rien laisser deviner.

create or replace function public.peek_join_code(p_code text, p_bucket text)
  returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare g record;
begin
  if not public.rate_hit('peek:' || coalesce(p_bucket, 'anon'), 10, '1 minute') then
    raise exception 'rate_limited';
  end if;
  -- Garde globale : un attaquant distribué ne contourne pas la limite par IP.
  if not public.rate_hit('peek:global', 600, '1 minute') then
    raise exception 'rate_limited';
  end if;

  select gr.name as group_name,
         coalesce(o.brand_name, o.name) as org_name,
         o.brand_color, o.logo_url
    into g
    from public.groups gr
    join public.organizations o on o.id = gr.org_id
   where upper(gr.join_code) = upper(trim(coalesce(p_code, '')))
     and gr.join_code_active
     and (gr.join_code_expires_at is null or gr.join_code_expires_at > now());
  if not found then
    raise exception 'invalid_code';
  end if;

  return jsonb_build_object(
    'org_name', g.org_name,
    'group_name', g.group_name,
    'brand_color', g.brand_color,
    'logo_url', g.logo_url
  );
end $$;
revoke execute on function public.peek_join_code(text, text) from public;
grant execute on function public.peek_join_code(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Jonction : nouvelle signature portant l'accord socle
-- ---------------------------------------------------------------------------
-- Le DROP est obligatoire. Garder l'ancienne signature à côté de la nouvelle
-- (qui a un paramètre à valeur par défaut) rend l'appel {p_code} ambigu :
-- PostgREST répond PGRST203 « Could not choose the best candidate function »
-- et TOUTES les jonctions cassent, y compris celles de la v0.6.0 déjà
-- installée. Avec une seule fonction à deux paramètres dont un par défaut,
-- l'ancien client (qui n'envoie que p_code) continue de fonctionner et
-- p_baseline_ack vaut false : il conserve alors son drapeau local.

drop function if exists public.join_group_with_code(text);

create or replace function public.join_group_with_code(
  p_code text,
  p_baseline_ack boolean default false
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare g record;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  -- Trou comblé : jusqu'ici un compte authentifié pouvait énumérer les codes
  -- sans aucune limite.
  if not public.rate_hit('join:' || auth.uid()::text, 10, '1 hour') then
    raise exception 'rate_limited';
  end if;

  select gr.id, gr.org_id, gr.name, o.brand_name, o.name as org_name
    into g
    from public.groups gr
    join public.organizations o on o.id = gr.org_id
   where upper(gr.join_code) = upper(trim(p_code))
     and gr.join_code_active
     and (gr.join_code_expires_at is null or gr.join_code_expires_at > now());
  if not found then
    raise exception 'invalid_code';
  end if;
  if exists (select 1 from public.profiles
             where id = auth.uid() and org_id is not null and org_id <> g.org_id) then
    raise exception 'already_in_other_org';
  end if;

  perform set_config('app.allow_org_change', 'on', true);
  update public.profiles
     set org_id = g.org_id,
         -- coalesce : on n'écrase jamais une acceptation plus ancienne, la
         -- date de premier accord est la preuve qui compte.
         baseline_consent_at = case when p_baseline_ack
           then coalesce(baseline_consent_at, now()) else baseline_consent_at end,
         baseline_consent_version = case when p_baseline_ack
           then coalesce(baseline_consent_version, 1) else baseline_consent_version end
   where id = auth.uid();
  insert into public.group_members (group_id, user_id)
    values (g.id, auth.uid())
    on conflict do nothing;

  return jsonb_build_object(
    'org_id', g.org_id,
    'group_id', g.id,
    'group_name', g.name,
    'org_name', coalesce(g.brand_name, g.org_name),
    'baseline_consent_at', (select baseline_consent_at from public.profiles where id = auth.uid())
  );
end $$;
revoke execute on function public.join_group_with_code(text, boolean) from public, anon;
grant execute on function public.join_group_with_code(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Acceptation a posteriori
-- ---------------------------------------------------------------------------
-- Chemin d'un utilisateur rattaché par un admin (attachUserByEmail) : il n'est
-- jamais passé par un écran de divulgation. La bannière du popup et l'encart
-- de /me appellent ceci.

create or replace function public.ack_baseline_consent(p_version integer default 1)
  returns timestamptz language plpgsql security definer set search_path = public
as $$
declare ts timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and org_id is not null) then
    raise exception 'no_org';
  end if;
  perform set_config('app.allow_org_change', 'on', true);
  update public.profiles
     set baseline_consent_at = coalesce(baseline_consent_at, now()),
         baseline_consent_version = coalesce(baseline_consent_version, p_version)
   where id = auth.uid()
  returning baseline_consent_at into ts;
  return ts;
end $$;
revoke execute on function public.ack_baseline_consent(integer) from public, anon;
grant execute on function public.ack_baseline_consent(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Reprise de l'existant
-- ---------------------------------------------------------------------------
-- Règle maison (0005) : aucun consentement utilisateur n'est présumé. On ne
-- pose donc la date QUE pour ceux qui ont déjà poussé au moins un événement —
-- la preuve qu'ils sont bien passés par la divulgation du popup, seul chemin
-- qui écrivait le drapeau. Tous les autres verront la bannière d'acceptation.

update public.profiles p
   set baseline_consent_at = e.first_ts,
       baseline_consent_version = 1
  from (select user_id, min(ts) as first_ts from public.prompt_events group by user_id) e
 where e.user_id = p.id
   and p.baseline_consent_at is null;
