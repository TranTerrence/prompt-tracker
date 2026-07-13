-- Données non-auth de la source coach-ia : l'organisation de démo et ses 5
-- templates socratiques. UUID conservés pour garder des liens prévisibles.
-- Idempotent. Les profils/événements ne sont PAS semés (ils dépendent des
-- utilisateurs auth, recréés par inscription — voir la doc de bascule).

insert into public.organizations
  (id, name, brand_name, brand_color, logo_url, threshold, capture_mode, llm_enabled, intercept_enabled, created_at)
values
  ('c85c638d-0763-4fb8-bef3-7efe6791f1e0', 'Démo — Coach IA', 'Coach IA', '#6d5bd0', null, 40, 'metadata', false, true, '2026-07-10T14:48:31.020684+00:00')
on conflict (id) do nothing;

insert into public.socratic_templates (id, org_id, key, question, active, created_at) values
  ('31df7a59-2254-4211-bae4-1f73d63cfd6f', 'c85c638d-0763-4fb8-bef3-7efe6791f1e0', 'delegation', 'Qu''as-tu déjà essayé ou pensé toi-même ? Décris ta piste : l''IA la renforcera au lieu de penser à ta place.', true, '2026-07-10T14:48:31.020684+00:00'),
  ('76f0c30e-8ac9-4c5f-a26b-a82613f818a8', 'c85c638d-0763-4fb8-bef3-7efe6791f1e0', 'clarte', 'Quel résultat précis attends-tu ? (livrable, format, longueur)', true, '2026-07-10T14:48:31.020684+00:00'),
  ('92337716-1594-4bdd-b30a-686253e83934', 'c85c638d-0763-4fb8-bef3-7efe6791f1e0', 'contexte', 'Pourquoi ce prompt ? Et avec quelles contraintes (public, format, délai) ?', true, '2026-07-10T14:48:31.020684+00:00'),
  ('29617e0c-fd39-4b71-836d-b32481dfa9a0', 'c85c638d-0763-4fb8-bef3-7efe6791f1e0', 'iteration', 'Que manquait-il à la réponse précédente pour que celle-ci soit meilleure ?', true, '2026-07-10T14:48:31.020684+00:00'),
  ('4a0a68b8-fa2a-4e2e-b075-c9797575055f', 'c85c638d-0763-4fb8-bef3-7efe6791f1e0', 'critique', 'Comment vérifieras-tu la réponse ? Pense à demander sources, limites ou alternatives.', true, '2026-07-10T14:48:31.020684+00:00')
on conflict (org_id, key) do nothing;
