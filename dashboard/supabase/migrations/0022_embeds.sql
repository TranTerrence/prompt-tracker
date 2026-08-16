-- Widgets embarquables par jeton signé (canal 4 du contrat d'intégration).
--
-- Le besoin : un établissement veut afficher la progression d'une classe dans
-- SON ENT, sans écrire de backend. L'API REST v1 ne s'y prête pas — elle est
-- server-to-server, sans CORS, et la clé ne doit jamais atteindre un
-- navigateur.
--
-- Où vit le secret de signature : EN BASE, un par organisation. L'alternative
-- (une variable d'environnement sur Vercel) casserait le parti architectural
-- du dépôt — toute l'autorisation vit en SQL, aucune service_role n'est
-- déployée — et n'apporterait rien : la route devrait de toute façon
-- redescendre chercher les données par une RPC. Avec le secret en base, la
-- révocation est immédiate, la rotation est un UPDATE, et la route Next
-- redevient ce qu'elle doit être : un moteur de rendu qui ne détient rien.
--
-- Garantie structurante, à tenir dans le temps : les widgets n'exposent QUE
-- des indicateurs. Aucun ne peut afficher `text`, `dialogue`, `answer` ni
-- `conv_key`. La question du consentement dans un iframe tiers disparaît donc
-- par construction — et c'est défendable devant un DPO.

-- ---------------------------------------------------------------------------
-- 1. Secret de signature, par organisation
-- ---------------------------------------------------------------------------
create table if not exists public.org_embed_secrets (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  secret text not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);
alter table public.org_embed_secrets enable row level security;
-- Aucune policy : même un administrateur n'a pas à lire ce secret. Il ne sert
-- qu'aux fonctions security definer ci-dessous.

-- Origines autorisées à encadrer les widgets (frame-ancestors).
create table if not exists public.org_embed_origins (
  org_id uuid not null references public.organizations(id) on delete cascade,
  origin text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, origin)
);
alter table public.org_embed_origins enable row level security;

drop policy if exists embed_origins_admin on public.org_embed_origins;
create policy embed_origins_admin on public.org_embed_origins for all
  using (public.auth_is_admin() and org_id = public.auth_org_id())
  with check (public.auth_is_admin() and org_id = public.auth_org_id());

-- ---------------------------------------------------------------------------
-- 2. Base64url (le format JWS n'accepte pas le base64 standard)
-- ---------------------------------------------------------------------------
create or replace function public.b64url(p bytea)
  returns text language sql immutable set search_path = public
as $$
  -- encode(...,'base64') insère des retours à la ligne tous les 76 caractères.
  select rtrim(translate(replace(encode(p, 'base64'), E'\n', ''), '+/', '-_'), '=');
$$;
revoke execute on function public.b64url(bytea) from public, anon, authenticated;

create or replace function public.b64url_decode(p text)
  returns bytea language sql immutable set search_path = public
as $$
  select decode(
    translate(p, '-_', '+/') || repeat('=', (4 - length(p) % 4) % 4),
    'base64'
  );
$$;
revoke execute on function public.b64url_decode(text) from public, anon, authenticated;

-- Secret de l'organisation, créé à la première demande.
create or replace function public.embed_secret(p_org uuid)
  returns text language plpgsql volatile security definer set search_path = public
as $$
declare s text;
begin
  select secret into s from public.org_embed_secrets where org_id = p_org;
  if s is null then
    s := encode(extensions.gen_random_bytes(32), 'hex');
    insert into public.org_embed_secrets (org_id, secret) values (p_org, s)
      on conflict (org_id) do nothing;
    select secret into s from public.org_embed_secrets where org_id = p_org;
  end if;
  return s;
end $$;
revoke execute on function public.embed_secret(uuid) from public, anon, authenticated;

-- Rotation : invalide TOUS les embeds vivants de l'organisation d'un coup.
create or replace function public.rotate_embed_secret()
  returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.auth_is_admin() then raise exception 'forbidden'; end if;
  update public.org_embed_secrets
     set secret = encode(extensions.gen_random_bytes(32), 'hex'), rotated_at = now()
   where org_id = public.auth_org_id();
end $$;
revoke execute on function public.rotate_embed_secret() from public, anon;
grant execute on function public.rotate_embed_secret() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Frappe d'un jeton (POST /api/v1/embed-tokens)
-- ---------------------------------------------------------------------------
-- Vrai JWS compact HS256, pas un HMAC maison : un HMAC suffirait à la
-- sécurité, mais le format standard permet à l'intégrateur d'inspecter `exp`
-- et le widget avec la bibliothèque de son langage, sans lire notre doc.
create or replace function public.api_embed_token(
  p_key text,
  p_widget text,
  p_scope_type text,
  p_scope_id uuid default null,
  p_ttl integer default 900,
  p_theme text default 'auto',
  p_lang text default 'fr'
) returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare
  k public.org_api_keys := public.api_auth(p_key, 'embed:mint');
  ttl integer := greatest(60, least(3600, coalesce(p_ttl, 900)));
  exp bigint := extract(epoch from now())::bigint + ttl;
  header text;
  payload text;
  signing_input text;
  sig text;
begin
  if p_widget not in ('class-progress', 'student-progress', 'outcome-mix', 'rubric-averages') then
    raise exception 'invalid_widget';
  end if;
  if p_scope_type not in ('group', 'student', 'org') then
    raise exception 'invalid_scope';
  end if;

  -- Le scope est re-validé contre l'organisation de la clé : impossible de
  -- frapper un jeton pour la classe de quelqu'un d'autre.
  if p_scope_type = 'group' then
    if not exists (select 1 from public.groups where id = p_scope_id and org_id = k.org_id) then
      raise exception 'invalid_scope';
    end if;
  elsif p_scope_type = 'student' then
    if not exists (select 1 from public.profiles where id = p_scope_id and org_id = k.org_id) then
      raise exception 'invalid_scope';
    end if;
  end if;
  if p_widget = 'class-progress' and p_scope_type = 'student' then
    raise exception 'invalid_scope';
  end if;
  if p_widget = 'student-progress' and p_scope_type <> 'student' then
    raise exception 'invalid_scope';
  end if;

  header := public.b64url(convert_to(
    json_build_object('alg', 'HS256', 'typ', 'JWT', 'kid', k.id)::text, 'utf8'));
  payload := public.b64url(convert_to(json_build_object(
    'iss', 'prompt-tracker',
    'aud', 'embed',
    'org', k.org_id,
    'w', p_widget,
    'sc', json_build_object('t', p_scope_type, 'id', p_scope_id),
    'th', case when p_theme in ('light', 'dark') then p_theme else 'auto' end,
    'l', case when p_lang = 'en' then 'en' else 'fr' end,
    'iat', extract(epoch from now())::bigint,
    'exp', exp
  )::text, 'utf8'));

  signing_input := header || '.' || payload;
  sig := public.b64url(extensions.hmac(signing_input, public.embed_secret(k.org_id), 'sha256'));

  return jsonb_build_object(
    'token', signing_input || '.' || sig,
    'expires_at', to_char(to_timestamp(exp) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
end $$;
revoke execute on function public.api_embed_token(text, text, text, uuid, integer, text, text) from public;
grant execute on function public.api_embed_token(text, text, text, uuid, integer, text, text) to anon;

-- ---------------------------------------------------------------------------
-- 4. Lecture d'un jeton + données du widget (rendu de /embed/<widget>)
-- ---------------------------------------------------------------------------
create or replace function public.api_embed_data(p_token text)
  returns jsonb language plpgsql volatile security definer set search_path = public
as $$
-- Préfixe v_ sur toutes les variables : en plpgsql une variable masque une
-- colonne du même nom, et `where org_id = org_id` se réduirait silencieusement
-- à « vrai » — ici, ça aurait désactivé le contrôle de révocation de clé.
declare
  v_parts text[];
  v_claims jsonb;
  v_org uuid;
  v_kid uuid;
  v_widget text;
  v_scope_type text;
  v_scope_id uuid;
  v_expected text;
  v_data jsonb;
  v_org_row record;
  v_origins text[];
begin
  v_parts := string_to_array(coalesce(p_token, ''), '.');
  if array_length(v_parts, 1) <> 3 then raise exception 'invalid_token'; end if;

  begin
    v_claims := convert_from(public.b64url_decode(v_parts[2]), 'utf8')::jsonb;
    -- kid vit dans l'EN-TÊTE JWS, pas dans les claims.
    v_kid := (convert_from(public.b64url_decode(v_parts[1]), 'utf8')::jsonb ->> 'kid')::uuid;
  exception when others then
    raise exception 'invalid_token';
  end;

  v_org := (v_claims ->> 'org')::uuid;
  v_widget := v_claims ->> 'w';
  v_scope_type := v_claims #>> '{sc,t}';
  v_scope_id := nullif(v_claims #>> '{sc,id}', '')::uuid;
  if v_org is null or v_kid is null then raise exception 'invalid_token'; end if;

  -- La signature est recalculée avec le secret de l'organisation revendiquée :
  -- forger `org` ne sert à rien, la signature ne suivra pas.
  v_expected := public.b64url(
    extensions.hmac(v_parts[1] || '.' || v_parts[2], public.embed_secret(v_org), 'sha256'));
  if v_expected <> v_parts[3] then raise exception 'invalid_token'; end if;

  if (v_claims ->> 'exp')::bigint < extract(epoch from now())::bigint then
    raise exception 'expired_token';
  end if;

  -- La clé qui a frappé le jeton doit toujours être vivante : révoquer une
  -- clé tue les embeds qu'elle a produits, au prochain rendu.
  if not exists (
    select 1 from public.org_api_keys k
     where k.id = v_kid and k.org_id = v_org and k.revoked_at is null
  ) then
    raise exception 'invalid_token';
  end if;

  -- Compteur SÉPARÉ de celui de l'API REST : un widget affiché sur une page
  -- d'accueil très visitée ne doit pas épuiser le quota d'ingestion du SI.
  if not public.rate_hit('embed:' || v_kid::text, 600, '1 minute') then
    raise exception 'rate_limited';
  end if;

  select coalesce(o.brand_name, o.name) as name, o.brand_color, o.logo_url
    into v_org_row from public.organizations o where o.id = v_org;

  select coalesce(array_agg(e.origin), array[]::text[]) into v_origins
    from public.org_embed_origins e where e.org_id = v_org;

  v_data := public.embed_widget_data(v_org, v_widget, v_scope_type, v_scope_id);

  return jsonb_build_object(
    'widget', v_widget,
    'scope', jsonb_build_object('type', v_scope_type, 'id', v_scope_id),
    'org', jsonb_build_object(
      'name', v_org_row.name, 'brand_color', v_org_row.brand_color, 'logo_url', v_org_row.logo_url),
    'theme', v_claims ->> 'th',
    'lang', v_claims ->> 'l',
    'frame_ancestors', to_jsonb(v_origins),
    'generated_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'data', v_data
  );
end $$;
revoke execute on function public.api_embed_data(text) from public;
grant execute on function public.api_embed_data(text) to anon;

-- ---------------------------------------------------------------------------
-- 5. Les données, par widget
-- ---------------------------------------------------------------------------
-- Quatre widgets, tous strictement indicateurs. Le « premier jet »
-- (score_before si intercepté, sinon scores.total) est la North Star du
-- produit : c'est ce que l'élève produit seul, avant tout coaching.
create or replace function public.embed_widget_data(
  p_org uuid, p_widget text, p_scope_type text, p_scope_id uuid
) returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  -- Périmètre commun à tous les widgets : l'organisation du jeton, les comptes
  -- actifs, et le scope demandé. Aucun widget ne lit text/dialogue/answer/
  -- conv_key — c'est la garantie qui rend ces iframes montrables à un tiers.
  if p_widget = 'class-progress' or p_widget = 'student-progress' then
    select coalesce(jsonb_agg(row order by week), '[]'::jsonb) into result from (
      select
        to_char(date_trunc('week', e.ts), 'YYYY-MM-DD') as week,
        round(avg(coalesce(e.score_before, (e.scores ->> 'total')::numeric)), 1) as first_draft,
        count(*) as events,
        count(distinct e.user_id) as students
      from public.prompt_events e
      join public.profiles p on p.id = e.user_id and not p.disabled
      where e.org_id = p_org
        and e.ts > now() - interval '26 weeks'
        and (
          p_scope_type = 'org'
          or (p_scope_type = 'student' and e.user_id = p_scope_id)
          or (p_scope_type = 'group' and exists (
                select 1 from public.group_members m
                 where m.group_id = p_scope_id and m.user_id = e.user_id))
        )
      group by 1
    ) row;

  elsif p_widget = 'outcome-mix' then
    select coalesce(jsonb_object_agg(outcome, n), '{}'::jsonb) into result from (
      select coalesce(e.outcome, 'sent') as outcome, count(*) as n
      from public.prompt_events e
      join public.profiles p on p.id = e.user_id and not p.disabled
      where e.org_id = p_org
        and e.ts > now() - interval '12 weeks'
        and (
          p_scope_type = 'org'
          or (p_scope_type = 'student' and e.user_id = p_scope_id)
          or (p_scope_type = 'group' and exists (
                select 1 from public.group_members m
                 where m.group_id = p_scope_id and m.user_id = e.user_id))
        )
      group by 1
    ) t;

  elsif p_widget = 'rubric-averages' then
    select jsonb_build_object(
      'clarte', round(avg((e.scores ->> 'clarte')::numeric), 1),
      'contexte', round(avg((e.scores ->> 'contexte')::numeric), 1),
      'iteration', round(avg((e.scores ->> 'iteration')::numeric), 1),
      'critique', round(avg((e.scores ->> 'critique')::numeric), 1),
      'events', count(*)
    ) into result
    from public.prompt_events e
    join public.profiles p on p.id = e.user_id and not p.disabled
    where e.org_id = p_org
      and e.ts > now() - interval '12 weeks'
      and (
        p_scope_type = 'org'
        or (p_scope_type = 'student' and e.user_id = p_scope_id)
        or (p_scope_type = 'group' and exists (
              select 1 from public.group_members m
               where m.group_id = p_scope_id and m.user_id = e.user_id))
      );
  else
    raise exception 'invalid_widget';
  end if;

  return coalesce(result, '[]'::jsonb);
end $$;
revoke execute on function public.embed_widget_data(uuid, text, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Le scope embed:mint n'est jamais implicite
-- ---------------------------------------------------------------------------
-- Les clés existantes portent {events:read, progress:read} : aucune ne peut
-- frapper un jeton d'embed tant qu'un administrateur ne l'a pas explicitement
-- coché. Le défaut de la colonne reste inchangé, à dessein.
