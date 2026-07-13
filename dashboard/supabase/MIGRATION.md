# Bascule coach-ia → nouveau projet Supabase (ovbvwawzrciwpudnaysp)

Migration **par recâblage** : l'ancienne base (`myvrkgurplqbrjzcuzwg`, org Cerene)
n'est ni supprimée ni modifiée. Le nouveau projet reçoit une copie du schéma
et des données non-auth ; les comptes sont recréés par inscription.

## État de préparation (fait dans la session du 2026-07-13)

- [x] Schéma complet extrait → `migrations/0001_init.sql` (6 tables, 2 enums,
      14 policies, 4 fonctions, 2 triggers, 2 index, grants)
- [x] Données non-auth → `seed.sql` (org de démo + 5 templates socratiques)
- [x] Edge Function → `functions/socratic-llm/index.ts`
- [x] Extension recâblée → `extension/src/supabase.js` (URL + clé publishable)
- [x] Dashboard recâblé → `.env.local` (noms `NEXT_PUBLIC_SUPABASE_URL` /
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, valeurs du nouveau projet)

## Application sur la cible : FAIT le 2026-07-13

Exécuté via le connecteur claude.ai « Supabase AI-Coach - SKOOTT » (scoppé au
seul projet cible), piloté par des instances `claude -p` headless :

- [x] `0001_init.sql` appliqué (apply_migration). Vérifié : 6 tables public,
      13 policies, triggers `enforce_capture_mode` + `on_auth_user_created`.
- [x] `seed.sql` exécuté. Vérifié : 1 organisation, 5 templates.
- [x] Edge Function `socratic-llm` déployée, ACTIVE, verify_jwt: true.
- [x] `0002_harden_trigger_functions.sql` (advisor lints 0028/0029) : revoke
      RPC sur les 2 fonctions de trigger ; RLS re-testée en rôle anon (OK).
- [x] API REST + Auth de la cible testées avec la clé publishable (HTTP 200).

## Étapes restantes (manuelles)

1. **Créer le compte admin** (stratégie « repartir propre ») :
   - S'inscrire sur le dashboard avec `terrence.tran0+coachtest@gmail.com`
     (le trigger `on_auth_user_created` crée le profil automatiquement).
   - Puis passer ce profil admin et le rattacher à l'org :
     ```sql
     update public.profiles
       set role = 'admin',
           org_id = 'c85c638d-0763-4fb8-bef3-7efe6791f1e0'
       where email = 'terrence.tran0+coachtest@gmail.com';
     ```
2. **Secret de l'Edge Function** (seulement si `llm_enabled` passe à true un
   jour) : poser `ANTHROPIC_API_KEY` sur la cible. Il n'était PAS posé sur
   l'ancienne base non plus : parité atteinte, fonction dormante.
3. **Auth → URL Configuration** (en prod seulement) : ajouter l'URL Vercel du
   dashboard comme Site URL / redirect. Le défaut localhost:3000 suffit en dev.
4. **Vérifier bout en bout** : login dashboard (compte admin → `/admin`),
   puis interception sur ChatGPT/Claude/Gemini avec l'extension rechargée.

## Non migré volontairement

- Les 2 utilisateurs `auth.users` (recréés par inscription, stratégie A).
- Le 1 `prompt_event` de test (donnée jetable).
- L'extension `supabase_vault` (gérée automatiquement par Supabase).
