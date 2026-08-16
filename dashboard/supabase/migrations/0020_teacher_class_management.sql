-- La classe est l'unité du professeur, mais toute sa gestion était admin-only.
-- Conséquence concrète : un enseignant ne pouvait ni voir ni partager le code
-- de SA classe, ni retirer un élève inscrit par erreur — il devait passer par
-- l'administrateur de l'établissement pour chaque geste de rentrée.
--
-- L'autorisation vit en SQL, pas seulement dans les server actions : c'est le
-- parti architectural du dépôt, et une garde côté TypeScript ne protège pas
-- des appels PostgREST directs.

-- ---------------------------------------------------------------------------
-- 1. Code de classe : régénérer, activer, dater
-- ---------------------------------------------------------------------------
create or replace function public.regenerate_group_code(p_group uuid)
  returns text language plpgsql security definer set search_path = public
as $$
declare code text;
begin
  if not public.auth_manages_group(p_group) then
    raise exception 'forbidden';
  end if;
  code := public.generate_join_code();
  update public.groups
     set join_code = code, join_code_active = true
   where id = p_group;
  return code;
end $$;
revoke execute on function public.regenerate_group_code(uuid) from public, anon;
grant execute on function public.regenerate_group_code(uuid) to authenticated;

-- RPC dédiées plutôt qu'une policy RLS UPDATE sur `groups` : une policy ne
-- restreint pas les COLONNES, elle laisserait un professeur renommer le groupe
-- ou le déplacer d'organisation.
create or replace function public.set_group_code_active(p_group uuid, p_active boolean)
  returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.auth_manages_group(p_group) then raise exception 'forbidden'; end if;
  update public.groups set join_code_active = coalesce(p_active, false) where id = p_group;
end $$;
revoke execute on function public.set_group_code_active(uuid, boolean) from public, anon;
grant execute on function public.set_group_code_active(uuid, boolean) to authenticated;

-- join_code_expires_at était une colonne morte : déclarée en 0004, jamais
-- écrite par aucune interface. Un lien d'invitation partagé dans un ENT rend
-- l'échéance nécessaire — un code de rentrée ne devrait pas rester ouvert
-- toute l'année.
create or replace function public.set_group_code_expiry(p_group uuid, p_expires_at timestamptz)
  returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.auth_manages_group(p_group) then raise exception 'forbidden'; end if;
  update public.groups set join_code_expires_at = p_expires_at where id = p_group;
end $$;
revoke execute on function public.set_group_code_expiry(uuid, timestamptz) from public, anon;
grant execute on function public.set_group_code_expiry(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Retirer un élève de SA classe
-- ---------------------------------------------------------------------------
-- Retirer du groupe, pas de l'organisation : le rattachement org et la
-- désactivation d'un compte restent des gestes d'administrateur.
create or replace function public.remove_group_member(p_group uuid, p_user uuid)
  returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.auth_manages_group(p_group) then raise exception 'forbidden'; end if;
  if p_user = auth.uid() then raise exception 'cannot_remove_self'; end if;
  delete from public.group_members where group_id = p_group and user_id = p_user;
end $$;
revoke execute on function public.remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Rétention : les invitations mortes rejoignent le balayage nocturne
-- ---------------------------------------------------------------------------
-- Reprise à l'identique de 0014 (mêmes fenêtres 90 jours / 12 mois, mêmes
-- clés de retour) avec DEUX compteurs ajoutés. Les clés existantes sont
-- conservées : le job pg_cron et tout appel manuel gardent le même contrat.
create or replace function public.apply_retention()
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare n_events_anonymized integer; n_posts_anonymized integer;
        n_events_deleted integer; n_posts_deleted integer;
        n_invitations integer; n_pairings integer;
begin
  -- 90 jours : le contenu s'efface, les indicateurs restent.
  update public.prompt_events
     set text = null, dialogue = null, conv_key = null
   where ts < now() - interval '90 days'
     and (text is not null or dialogue is not null or conv_key is not null);
  get diagnostics n_events_anonymized = row_count;

  update public.post_events
     set answer = null, conv_key = null
   where ts < now() - interval '90 days'
     and (answer is not null or conv_key is not null);
  get diagnostics n_posts_anonymized = row_count;

  -- 12 mois : les événements eux-mêmes disparaissent.
  delete from public.prompt_events where ts < now() - interval '12 months';
  get diagnostics n_events_deleted = row_count;

  delete from public.post_events where ts < now() - interval '12 months';
  get diagnostics n_posts_deleted = row_count;

  -- Nouveau : une invitation jamais acceptée est une adresse personnelle sans
  -- base légale durable ; une demande d'appairage périmée n'a plus d'objet.
  n_invitations := public.purge_stale_invitations();
  n_pairings := public.purge_pairing_requests();

  return jsonb_build_object(
    'events_anonymized', n_events_anonymized,
    'posts_anonymized', n_posts_anonymized,
    'events_deleted', n_events_deleted,
    'posts_deleted', n_posts_deleted,
    'invitations_deleted', n_invitations,
    'pairings_deleted', n_pairings
  );
end $$;
revoke execute on function public.apply_retention() from public, anon, authenticated;
