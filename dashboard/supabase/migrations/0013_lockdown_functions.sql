-- Verrouillage : revoke du grant PUBLIC implicite sur les fonctions internes
-- (un revoke ciblé anon/authenticated ne suffit pas, PUBLIC reste). Restent
-- volontairement exécutables : les helpers auth_* (évalués par les policies
-- RLS avec le rôle appelant), les RPC utilisateur (join, purge, regenerate,
-- gardées par leurs propres contrôles) et les api_* (gardées par clé API).

-- Fonctions de trigger et helpers internes : personne ne les appelle en RPC.
revoke execute on function public.enforce_consent() from public;
revoke execute on function public.enforce_consent_post() from public;
revoke execute on function public.log_consent() from public;
revoke execute on function public.protect_profile_fields() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.generate_join_code() from public;
revoke execute on function public.effective_capture(uuid, uuid, public.consent_category) from public;
revoke execute on function public.api_hit(uuid, integer) from public;
revoke execute on function public.api_auth(text, text) from public;

-- RPC à audience explicite : utilisateurs connectés uniquement.
revoke execute on function public.join_group_with_code(text) from public;
grant execute on function public.join_group_with_code(text) to authenticated;
revoke execute on function public.purge_my_content() from public;
grant execute on function public.purge_my_content() to authenticated;
revoke execute on function public.regenerate_group_code(uuid) from public;
grant execute on function public.regenerate_group_code(uuid) to authenticated;
