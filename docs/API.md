# API d'organisation Prompt Tracker (v1)

**La référence complète vit désormais dans une spec OpenAPI 3.1, source de
vérité du contrat.**

| Ressource | Où |
|---|---|
| Référence interactive (publique) | https://track-prompt.vercel.app/docs/api |
| Spec OpenAPI 3.1 | https://track-prompt.vercel.app/openapi.yaml — dans le dépôt : [`dashboard/public/openapi.yaml`](../dashboard/public/openapi.yaml) |
| Contrat d'intégration (gouvernance, canaux, CSV) | [INTEGRATION.md](INTEGRATION.md) |

La spec décrit les six endpoints — cinq en lecture (`/groups`, `/students`,
`/events`, `/post-events`, `/progress`) et `POST /embed-tokens` —, les schémas
complets, la pagination keyset, les scopes, les codes d'erreur et des exemples
curl et Node.

## Ce qu'il faut savoir avant de lire la spec

- Base : `https://track-prompt.vercel.app/api/v1`, périmètre = votre
  organisation. Aucun endpoint ne modifie vos données ; le seul POST,
  `/embed-tokens`, est sans état (il signe une capacité d'affichage).
- Auth : `Authorization: Bearer pt_live_…` (dashboard, Paramètres → Clés API ;
  seul le hash est conservé, affichage unique). 60 requêtes/minute par clé.
- Scopes cochés à la création : `events:read`, `progress:read`, `embed:mint`.
  Ce dernier n'est **jamais** attribué d'office.
- **Widgets embarqués** : `POST /embed-tokens` frappe un jeton court, à passer
  à une iframe `/embed/<widget>`. Ces widgets n'exposent que des indicateurs —
  jamais de contenu — et ne s'affichent que dans les origines déclarées par
  l'organisation. Détail dans [INTEGRATION.md](INTEGRATION.md), canal 4.
- **Consentement** : les indicateurs sont toujours disponibles ; le CONTENU
  (`text`, `dialogue`, `answer`, `conv_key`) n'est renvoyé que si l'utilisateur
  y consent **au moment de l'appel**. Une révocation coupe l'accès y compris à
  l'historique. Champs non consentis : `null`, sans erreur.
- **Server-to-server** : aucun en-tête CORS, aucune méthode `OPTIONS`. Un appel
  depuis un navigateur échoue par conception, et la clé ne doit jamais y vivre.

## Faire évoluer l'API

Un nouvel endpoint, un nouveau champ ou un nouveau scope se documente **dans
`dashboard/public/openapi.yaml`**, en même temps que le code. La page
`/docs/api` (route `dashboard/app/docs/api/route.ts`, rendu Scalar) lit cette
spec : il n'y a rien d'autre à mettre à jour.

Contrôle : `npx @redocly/cli lint dashboard/public/openapi.yaml`.

## Architecture (pour les curieux)

Les routes Next.js (`dashboard/app/api/v1/*`) délèguent à des fonctions SQL
`security definer` (migrations `0011_api_rpcs.sql` et
`0015_api_post_events.sql`) : vérification du hash de clé, scopes, rate limit
et filtre de consentement vivent dans Postgres, au plus près de la donnée.
Aucune clé `service_role` n'est déployée.
