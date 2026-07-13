-- Durcissement post-advisor (lints 0028/0029) : les fonctions de trigger ne
-- doivent pas être invocables en RPC par les rôles clients. Les triggers
-- s'exécutent avec les droits du propriétaire, donc aucune régression.
-- auth_is_admin / auth_org_id ne sont PAS touchées : les policies RLS les
-- évaluent avec les droits de l'appelant (anon/authenticated).

revoke execute on function public.enforce_capture_mode() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
