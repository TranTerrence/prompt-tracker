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

## À exécuter en session NEUVE (connecteur MCP `supabase` du nouveau projet
authentifié via `claude /mcp`, sinon l'agent n'a pas accès à la cible)

1. **Appliquer le schéma** : exécuter `migrations/0001_init.sql` sur la cible
   (`apply_migration` ou l'éditeur SQL Supabase).
2. **Semer les données** : exécuter `seed.sql`.
3. **Créer le compte admin** (stratégie « repartir propre ») :
   - S'inscrire sur le dashboard avec `terrence.tran0+coachtest@gmail.com`
     (le trigger `on_auth_user_created` crée le profil automatiquement).
   - Puis passer ce profil admin et le rattacher à l'org :
     ```sql
     update public.profiles
       set role = 'admin',
           org_id = 'c85c638d-0763-4fb8-bef3-7efe6791f1e0'
       where email = 'terrence.tran0+coachtest@gmail.com';
     ```
4. **Redéployer l'Edge Function** `socratic-llm` sur la cible, puis définir son
   secret : `ANTHROPIC_API_KEY` (les secrets `SUPABASE_URL` /
   `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement par Supabase).
5. **Auth → URL Configuration** (Supabase du nouveau projet) : ajouter l'URL du
   dashboard (localhost:3000 en dev, l'URL Vercel en prod) comme Site URL /
   redirect autorisé.
6. **Vérifier bout en bout** : login dashboard (compte admin → `/admin`),
   puis interception sur ChatGPT/Claude/Gemini avec l'extension rechargée.

## Non migré volontairement

- Les 2 utilisateurs `auth.users` (recréés par inscription — stratégie A).
- Le 1 `prompt_event` de test (donnée jetable).
- L'extension `supabase_vault` (gérée automatiquement par Supabase).
