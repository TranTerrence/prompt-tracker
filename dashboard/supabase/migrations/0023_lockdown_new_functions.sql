-- Verrouillage en bloc des fonctions ajoutées par 0017 → 0022.
-- (Doit rester la DERNIÈRE migration d'un lot : toute nouvelle fonction créée
-- après elle repartirait avec le grant implicite de Supabase.)
--
-- Supabase pose un GRANT EXECUTE implicite à anon et authenticated sur TOUTE
-- fonction nouvellement créée, et `revoke ... from public` seul ne l'enlève
-- pas (c'est la leçon de 0013 et 0016). Chaque migration fait déjà ses
-- revoke/grant ; cette migration les réaffirme en un seul endroit pour qu'un
-- oubli se voie, et pour qu'un `create or replace` ultérieur qui réattribue
-- les droits puisse être rattrapé en rejouant ce fichier.
--
-- Une fonction interne oubliée ici (b64url, embed_secret, rate_hit…) serait
-- directement appelable en RPC par n'importe quel visiteur.

-- ---------------------------------------------------------------------------
-- Internes : personne ne les appelle en RPC
-- ---------------------------------------------------------------------------
revoke execute on function public.rate_hit(text, integer, interval)
  from public, anon, authenticated;
revoke execute on function public.protect_profile_fields()
  from public, anon, authenticated;
revoke execute on function public.purge_pairing_requests()
  from public, anon, authenticated;
revoke execute on function public.purge_stale_invitations()
  from public, anon, authenticated;
revoke execute on function public.apply_retention()
  from public, anon, authenticated;
revoke execute on function public.b64url(bytea)
  from public, anon, authenticated;
revoke execute on function public.b64url_decode(text)
  from public, anon, authenticated;
revoke execute on function public.embed_secret(uuid)
  from public, anon, authenticated;
revoke execute on function public.embed_widget_data(uuid, text, text, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Résolveurs publics : appelés AVANT toute authentification, depuis les pages
-- /join/<code> et /invitation/<token>. Protégés par leur propre limiteur et
-- ne renvoyant qu'un nom d'affichage.
-- ---------------------------------------------------------------------------
revoke execute on function public.peek_join_code(text, text) from public;
grant execute on function public.peek_join_code(text, text) to anon, authenticated;

revoke execute on function public.peek_invitation(text, text) from public;
grant execute on function public.peek_invitation(text, text) to anon, authenticated;

-- Appairage : l'extension n'a pas de session au moment où elle ouvre la
-- demande, d'où anon. Le secret (device_code) est la seule chose qui compte,
-- et il ne donne rien sans une approbation faite par un compte connecté.
revoke execute on function public.create_pairing_request(text, text) from public;
grant execute on function public.create_pairing_request(text, text) to anon, authenticated;
revoke execute on function public.redeem_pairing(text) from public;
grant execute on function public.redeem_pairing(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Utilisateurs connectés
-- ---------------------------------------------------------------------------
revoke execute on function public.join_group_with_code(text, boolean) from public, anon;
grant execute on function public.join_group_with_code(text, boolean) to authenticated;

revoke execute on function public.ack_baseline_consent(integer) from public, anon;
grant execute on function public.ack_baseline_consent(integer) to authenticated;

revoke execute on function public.approve_pairing(text) from public, anon;
grant execute on function public.approve_pairing(text) to authenticated;

revoke execute on function public.auth_manages_group(uuid) from public, anon;
grant execute on function public.auth_manages_group(uuid) to authenticated;

revoke execute on function public.create_invitations(uuid, text[], text[], integer) from public, anon;
grant execute on function public.create_invitations(uuid, text[], text[], integer) to authenticated;
revoke execute on function public.accept_invitation(text, boolean) from public, anon;
grant execute on function public.accept_invitation(text, boolean) to authenticated;
revoke execute on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.revoke_invitation(uuid) to authenticated;
revoke execute on function public.resend_invitation(uuid) from public, anon;
grant execute on function public.resend_invitation(uuid) to authenticated;

revoke execute on function public.regenerate_group_code(uuid) from public, anon;
grant execute on function public.regenerate_group_code(uuid) to authenticated;
revoke execute on function public.set_group_code_active(uuid, boolean) from public, anon;
grant execute on function public.set_group_code_active(uuid, boolean) to authenticated;
revoke execute on function public.set_group_code_expiry(uuid, timestamptz) from public, anon;
grant execute on function public.set_group_code_expiry(uuid, timestamptz) to authenticated;
revoke execute on function public.remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

revoke execute on function public.rotate_embed_secret() from public, anon;
grant execute on function public.rotate_embed_secret() to authenticated;

-- ---------------------------------------------------------------------------
-- API par clé d'organisation : appelées par les routes Next avec la clé anon,
-- l'autorisation étant portée par la clé pt_live_ passée en argument.
-- ---------------------------------------------------------------------------
revoke execute on function public.api_embed_token(text, text, text, uuid, integer, text, text) from public;
grant execute on function public.api_embed_token(text, text, text, uuid, integer, text, text) to anon;
revoke execute on function public.api_embed_data(text) from public;
grant execute on function public.api_embed_data(text) to anon;

-- ---------------------------------------------------------------------------
-- Contrôle : liste ce qui reste exécutable par anon/authenticated.
-- À relire après chaque déploiement de migration.
-- ---------------------------------------------------------------------------
-- select p.proname, r.rolname
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   cross join lateral (values ('anon'), ('authenticated')) as r(rolname)
--  where n.nspname = 'public'
--    and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
--  order by 1, 2;
