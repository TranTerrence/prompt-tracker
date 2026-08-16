-- Invitations nominatives à une classe.
--
-- Contrainte de départ : `auth.admin.inviteUserByEmail` exige la service_role,
-- volontairement absente de Vercel. Trois voies possibles ; celle-ci (table
-- d'invitations + jeton propre) est retenue parce qu'elle :
--   - ne crée AUCUN compte auth.users pour des gens qui n'accepteront jamais
--     (minimisation, cohérent avec le reste du produit) ;
--   - ne dépend pas du SMTP pour fonctionner : le mode « copier les liens »
--     marche sans e-mail, ce qui compte le jour du déploiement (le SMTP
--     Supabase par défaut plafonne à quelques mails/heure, une classe de 30
--     échouerait) ;
--   - retombe sur le MÊME chemin de jonction que /join/<CODE> : une seule
--     transaction écrit à la fois le rattachement et `baseline_consent_at`.
--
-- Ce qui a été écarté : étendre handle_new_user() pour auto-rattacher par
-- correspondance d'adresse. Ce serait le seul chemin rattachant un compte SANS
-- écran de divulgation — donc sans consentement socle — recréant exactement la
-- classe de bug que 0017 corrige. Et si la confirmation d'e-mail est
-- désactivée, n'importe qui s'inscrivant avec eleve@lycee.fr entrerait dans la
-- classe.

create table if not exists public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  email text not null,
  -- Jamais le jeton en clair : même discipline que org_api_keys.
  token_hash text not null unique,
  display_name text,
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  send_error text,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz
);

-- Une seule invitation vivante par (classe, adresse) : relancer met à jour au
-- lieu d'empiler.
create unique index if not exists group_invitations_pending
  on public.group_invitations (group_id, lower(email))
  where accepted_at is null and revoked_at is null;

create index if not exists group_invitations_group on public.group_invitations (group_id);

alter table public.group_invitations enable row level security;

-- Admin de l'org, ou professeur membre du groupe : la classe est l'unité du
-- professeur, c'est lui qui invite ses élèves.
drop policy if exists invitations_read on public.group_invitations;
create policy invitations_read on public.group_invitations for select
  using (
    (public.auth_is_admin() and org_id = public.auth_org_id())
    or (public.auth_is_teacher() and public.auth_in_group(group_id))
  );
-- Aucune policy d'écriture : tout passe par les RPC ci-dessous, qui portent
-- les mêmes contrôles et savent générer les jetons.

-- ---------------------------------------------------------------------------
-- Qui a le droit de gérer cette classe
-- ---------------------------------------------------------------------------
create or replace function public.auth_manages_group(p_group uuid)
  returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.groups g
     where g.id = p_group
       and (
         (public.auth_is_admin() and g.org_id = public.auth_org_id())
         or (public.auth_is_teacher() and public.auth_in_group(g.id))
       )
  );
$$;
revoke execute on function public.auth_manages_group(uuid) from public;
grant execute on function public.auth_manages_group(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Création en masse
-- ---------------------------------------------------------------------------
-- Renvoie les jetons EN CLAIR une seule fois (comme regenerate_group_code) :
-- l'appelant les transforme en liens, à copier ou à envoyer par e-mail.
create or replace function public.create_invitations(
  p_group uuid,
  p_emails text[],
  p_names text[] default null,
  p_ttl_days integer default 30
) returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare
  g record;
  addr text;
  clean text;
  tok text;
  i integer := 0;
  out_rows jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.auth_manages_group(p_group) then raise exception 'forbidden'; end if;
  if array_length(p_emails, 1) is null then return out_rows; end if;
  if array_length(p_emails, 1) > 200 then raise exception 'too_many_invitations'; end if;

  select id, org_id into g from public.groups where id = p_group;

  foreach addr in array p_emails loop
    i := i + 1;
    clean := lower(trim(coalesce(addr, '')));
    if clean = '' or clean !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      out_rows := out_rows || jsonb_build_object('email', addr, 'status', 'invalid');
      continue;
    end if;

    -- Déjà membre : ne rien faire, le dire.
    if exists (
      select 1 from public.group_members m
      join public.profiles p on p.id = m.user_id
      where m.group_id = p_group and lower(p.email) = clean
    ) then
      out_rows := out_rows || jsonb_build_object('email', clean, 'status', 'already_member');
      continue;
    end if;

    -- Jeton généré DANS le corps de la RPC, jamais en DEFAULT de colonne :
    -- une expression de DEFAULT est évaluée avec les droits de l'appelant
    -- (c'est l'incident corrigé par 0016).
    tok := encode(extensions.gen_random_bytes(24), 'hex');

    insert into public.group_invitations
      (org_id, group_id, email, token_hash, display_name, expires_at, created_by)
    values (
      g.org_id, p_group, clean,
      encode(extensions.digest(tok, 'sha256'), 'hex'),
      nullif(trim(coalesce(p_names[i], '')), ''),
      now() + make_interval(days => greatest(1, least(365, p_ttl_days))),
      auth.uid()
    )
    on conflict (group_id, lower(email)) where accepted_at is null and revoked_at is null
    do update set
      token_hash = excluded.token_hash,
      -- Pas de préfixe de schéma ici : dans un DO UPDATE, la ligne existante se
      -- désigne par le nom de table seul.
      display_name = coalesce(excluded.display_name, group_invitations.display_name),
      expires_at = excluded.expires_at,
      created_by = excluded.created_by,
      sent_at = null,
      send_error = null;

    out_rows := out_rows || jsonb_build_object('email', clean, 'status', 'invited', 'token', tok);
  end loop;

  return out_rows;
end $$;
revoke execute on function public.create_invitations(uuid, text[], text[], integer) from public, anon;
grant execute on function public.create_invitations(uuid, text[], text[], integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Résolution publique d'un jeton (page /invitation/<token>)
-- ---------------------------------------------------------------------------
create or replace function public.peek_invitation(p_token text, p_bucket text)
  returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare inv record;
begin
  if not public.rate_hit('invite:' || coalesce(p_bucket, 'anon'), 10, '1 minute') then
    raise exception 'rate_limited';
  end if;

  select i.email, g.name as group_name, coalesce(o.brand_name, o.name) as org_name
    into inv
    from public.group_invitations i
    join public.groups g on g.id = i.group_id
    join public.organizations o on o.id = i.org_id
   where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and i.accepted_at is null
     and i.revoked_at is null
     and i.expires_at > now();
  if not found then raise exception 'invalid_invitation'; end if;

  -- L'adresse est masquée : la page doit pouvoir dire « ce lien est pour
  -- l'adresse a…@lycee.fr » sans exposer l'annuaire à qui trouve un jeton.
  return jsonb_build_object(
    'org_name', inv.org_name,
    'group_name', inv.group_name,
    'email_masked', regexp_replace(inv.email, '^(.).*(@.*)$', '\1…\2')
  );
end $$;
revoke execute on function public.peek_invitation(text, text) from public;
grant execute on function public.peek_invitation(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Acceptation
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation(
  p_token text,
  p_baseline_ack boolean default false
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  inv record;
  my_email text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select i.*, g.name as group_name, coalesce(o.brand_name, o.name) as org_name
    into inv
    from public.group_invitations i
    join public.groups g on g.id = i.group_id
    join public.organizations o on o.id = i.org_id
   where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and i.accepted_at is null
     and i.revoked_at is null
     and i.expires_at > now();
  if not found then raise exception 'invalid_invitation'; end if;

  -- Le lien est nominatif : le transférer ne donne rien. Sans ce contrôle, un
  -- lien partagé dans un groupe de discussion ferait entrer n'importe qui.
  select lower(email) into my_email from public.profiles where id = auth.uid();
  if my_email is distinct from inv.email then
    raise exception 'email_mismatch';
  end if;

  if exists (select 1 from public.profiles
             where id = auth.uid() and org_id is not null and org_id <> inv.org_id) then
    raise exception 'already_in_other_org';
  end if;

  perform set_config('app.allow_org_change', 'on', true);
  update public.profiles
     set org_id = inv.org_id,
         baseline_consent_at = case when p_baseline_ack
           then coalesce(baseline_consent_at, now()) else baseline_consent_at end,
         baseline_consent_version = case when p_baseline_ack
           then coalesce(baseline_consent_version, 1) else baseline_consent_version end,
         display_name = coalesce(display_name, inv.display_name)
   where id = auth.uid();

  insert into public.group_members (group_id, user_id)
    values (inv.group_id, auth.uid())
    on conflict do nothing;

  update public.group_invitations
     set accepted_at = now(), accepted_by = auth.uid()
   where id = inv.id;

  return jsonb_build_object(
    'org_id', inv.org_id,
    'group_id', inv.group_id,
    'group_name', inv.group_name,
    'org_name', inv.org_name
  );
end $$;
revoke execute on function public.accept_invitation(text, boolean) from public, anon;
grant execute on function public.accept_invitation(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Révocation et relance
-- ---------------------------------------------------------------------------
create or replace function public.revoke_invitation(p_id uuid)
  returns void language plpgsql security definer set search_path = public
as $$
declare grp uuid;
begin
  select group_id into grp from public.group_invitations where id = p_id;
  if grp is null then raise exception 'not_found'; end if;
  if not public.auth_manages_group(grp) then raise exception 'forbidden'; end if;
  update public.group_invitations set revoked_at = now()
   where id = p_id and accepted_at is null;
end $$;
revoke execute on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.revoke_invitation(uuid) to authenticated;

-- Relance : NOUVEAU jeton (l'ancien cesse de fonctionner), nouvelle échéance.
create or replace function public.resend_invitation(p_id uuid)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  inv record;
  tok text;
begin
  select * into inv from public.group_invitations where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if not public.auth_manages_group(inv.group_id) then raise exception 'forbidden'; end if;
  if inv.accepted_at is not null then raise exception 'already_accepted'; end if;

  tok := encode(extensions.gen_random_bytes(24), 'hex');
  update public.group_invitations
     set token_hash = encode(extensions.digest(tok, 'sha256'), 'hex'),
         expires_at = now() + interval '30 days',
         revoked_at = null,
         sent_at = null,
         send_error = null
   where id = p_id;

  return jsonb_build_object('email', inv.email, 'token', tok);
end $$;
revoke execute on function public.resend_invitation(uuid) from public, anon;
grant execute on function public.resend_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rétention : les adresses invitées ne traînent pas indéfiniment
-- ---------------------------------------------------------------------------
-- Une invitation jamais acceptée est une donnée personnelle (une adresse) sans
-- base légale durable. 0014 balaie déjà événements et contenus ; on y ajoute
-- les invitations mortes depuis plus de 90 jours.
create or replace function public.purge_stale_invitations()
  returns integer language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  delete from public.group_invitations
   where accepted_at is null
     and expires_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_stale_invitations() from public, anon, authenticated;
