# API d'organisation Prompt Tracker (v1)

API REST machine-to-machine pour récupérer la donnée de votre organisation
(SI pédagogique, entrepôt de données, LMS). Lecture seule.

Base : `https://track-prompt.vercel.app/api/v1`

## Authentification

Créez une clé dans le dashboard (Paramètres → Clés API). Elle n'est affichée
qu'une seule fois ; seul son hash est conservé.

```
Authorization: Bearer pt_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Réponses d'erreur : `401 invalid_key` (clé inconnue ou révoquée),
`403 forbidden_scope`, `429 rate_limited` (60 requêtes/minute par clé,
en-tête `Retry-After`).

## Consentement : la règle qui gouverne tout

Les indicateurs (scores, catégories, issues, volumes) sont toujours
disponibles. Le CONTENU (`text`, `dialogue`, `answer`, `conv_key`) n'est renvoyé que si
l'utilisateur concerné y consent **au moment de l'appel** : une révocation
coupe immédiatement l'accès, y compris à l'historique déjà stocké. Les champs
non consentis valent `null`, sans erreur.

## Endpoints

### GET /groups
Liste des groupes (classes) : `id`, `name`, `member_count`.

### GET /students?group_id=
Annuaire : `id`, `display_name`, `email`, `role`, `disabled`, `groups`,
`consents` (état courant par catégorie).

### GET /events?since=&until=&group_id=&user_id=&cursor=&limit=
Événements de prompts, du plus récent au plus ancien.
- `since`/`until` : bornes ISO 8601 (until exclus)
- `limit` : 1 à 500 (défaut 100)
- `cursor` : jeton opaque renvoyé dans `next_cursor` ; répéter l'appel avec
  ce jeton jusqu'à `next_cursor: null`
- Champs par événement : identifiants, `ts`, `site`, `category`, `words`,
  `scores` (clarte/contexte/iteration/critique/total), `intercepted`,
  `outcome`, `score_before` (le PREMIER JET : la mesure de l'apprentissage),
  `score_after`, `rounds`, `answers_count`, et si consentis : `text`,
  `dialogue` (paires question/réponse du raisonnement socratique),
  `conv_key`.

### GET /post-events?since=&until=&group_id=&user_id=&cursor=&limit=
Réflexions du « miroir d'après » (la question réflexive posée après une
réponse de l'IA), du plus récent au plus ancien. Mêmes paramètres et même
pagination que `/events`.
- Champs par réflexion : identifiants, `ts`, `site`, `post_key`
  (`explain` reformulation / `verify` vérification / `disagree` désaccord),
  `category`, `answered` (l'étudiant a-t-il répondu), `answer_words`, et si
  consentis : `answer` (catégorie de consentement `post_reflection`),
  `conv_key`.

### GET /progress?group_id=&user_id=&from=&to=
Agrégats hebdomadaires par étudiant : `week`, `events`, `avg_first_draft`
(North Star : ce que l'étudiant produit seul), `avg_after`, `intercepted`,
`improved`, `sent_anyway`, `cancelled`. Calculé sans aucun contenu : complet
même sans consentement.

## Exemple

```bash
KEY="pt_live_…"
BASE="https://track-prompt.vercel.app/api/v1"

curl -s "$BASE/groups" -H "Authorization: Bearer $KEY"
curl -s "$BASE/progress?from=2026-06-01" -H "Authorization: Bearer $KEY"
curl -s "$BASE/events?limit=200" -H "Authorization: Bearer $KEY" | jq '.next_cursor'
```

## Architecture (pour les curieux)

Les routes Next.js délèguent à des fonctions SQL `security definer`
(migrations `0011_api_rpcs.sql` et `0015_api_post_events.sql`) : vérification du hash de clé, scopes, rate
limit et filtre de consentement vivent dans Postgres, au plus près de la
donnée. Aucune clé service_role n'est déployée.
