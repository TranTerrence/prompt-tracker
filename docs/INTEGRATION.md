# Contrat d'intégration Prompt Tracker (v1.0)

Comment brancher votre application (SI pédagogique, journal réflexif, entrepôt
de données, LMS) sur les données produites par l'extension Prompt Tracker.

Le principe : le plugin reste souverain sur son backend et sur la règle de
consentement ; les applications consomment. Aucune référence à une application
particulière n'existe dans le code du plugin : tout passe par la configuration
d'organisation et par les canaux décrits ici.

## Vue d'ensemble : trois canaux

| Canal | Pour qui | Latence | Mise en place |
|---|---|---|---|
| 1. API REST (pull) | Toute application serveur | Le rythme de votre cron (15 min recommandé) | Une clé d'API d'organisation |
| 2. Export CSV | Analyses ponctuelles, tableurs | Manuelle | Aucune |
| 3. Push vers votre endpoint | Besoin temps réel | Réservé à une v2 du contrat | Non implémenté |

## Canal 1 : l'API REST (canal principal)

Référence complète : [API.md](API.md). L'essentiel :

- Base : `https://track-prompt.vercel.app/api/v1`
- Authentification : `Authorization: Bearer pt_live_...` (clé créée dans le
  dashboard, Paramètres puis Clés API ; seul son hash est conservé ; 60
  requêtes/minute).
- Endpoints : `/groups`, `/students`, `/events`, `/post-events`, `/progress`.
- Lecture seule, périmètre = votre organisation, consentement appliqué par le
  serveur à chaque appel.

### Recette d'ingestion recommandée (cron 15 minutes)

1. Persistez un curseur `last_sync_ts` (initialement la date de déploiement).
2. Toutes les 15 minutes : `GET /events?since=<last_sync_ts moins 1 h>&limit=500`,
   puis suivez `next_cursor` jusqu'à `null`. Le recouvrement d'une heure absorbe
   les synchronisations tardives de l'extension (file hors-ligne des élèves).
3. Upsert dans votre table de staging avec **`id` comme clé d'idempotence**
   (c'est l'identifiant serveur, stable ; `client_event_id` est l'idempotence
   interne extension vers backend, gardez-le en colonne informative).
4. Avancez `last_sync_ts` au `ts` le plus récent reçu.
5. Même boucle pour `/post-events`. Pour les agrégats hebdomadaires, `/progress`
   les fournit déjà calculés (complets même sans consentement).

Un événement peut être re-reçu avec un contenu devenu `null` : l'utilisateur a
révoqué son consentement entre deux passages. Votre upsert doit écraser le
contenu par `null` dans ce cas (la révocation est rétroactive, voir plus bas).

## Le schéma `prompt_event` (l'objet pivot)

| Champ | Type | Sens |
|---|---|---|
| `id` | uuid | Identifiant serveur. Votre clé d'idempotence. |
| `client_event_id` | string | Identifiant généré par l'extension (idempotence extension vers backend). |
| `user_id` | uuid | L'étudiant (voir `/students` pour l'annuaire). |
| `ts` | ISO 8601 | Moment de l'envoi du prompt. |
| `site` | string | `chatgpt`, `claude`, `gemini`, `mistral`, `grok` (liste extensible). |
| `category` | string | Détection locale par mots-clés : `code`, `rédaction`, `résumé`, `traduction`, `analyse`, `brainstorming`, `recherche`, `autre`. |
| `words` | int | Nombre de mots du prompt. |
| `scores` | objet | `{ clarte, contexte, iteration, critique, total }` : 4 rubriques sur 25, total sur 100. Score du prompt effectivement envoyé. |
| `intercepted` | bool | Le dialogue socratique s'est-il ouvert (score sous le seuil de l'org). |
| `outcome` | enum | `sent`, `improved`, `sent_anyway`, `cancelled` (voir la règle des modes ci-dessous). |
| `score_before` | int | Le PREMIER JET avant coaching. Rempli seulement si intercepté. |
| `score_after` | int | Score après amélioration (si `improved`). |
| `mirror_shown` | bool | Une suggestion ou le dialogue a été montré. |
| `mirror_feedback` | string | Retour de l'utilisateur sur le miroir (`useful`, `dismissed`, `paused_thread`...). |
| `rounds` | int | Questions socratiques posées pendant l'interception. |
| `answers_count` | int | Réponses effectivement données. |
| `text` | string ou null | Le prompt. **Soumis à consentement** (`prompt_text`). |
| `dialogue` | tableau ou null | Paires `{ q, a, axis }` du raisonnement socratique. **Soumis à consentement** (`socratic_dialogue`). |
| `conv_key` | string ou null | Clé de conversation (regroupe les prompts d'un même fil). **Soumise à consentement** (`conversation_history`). |

La mesure d'apprentissage recommandée (le « premier jet ») :
`score_before` si l'événement est intercepté, sinon `scores.total`. C'est ce
que l'étudiant produit seul, avant toute aide.

## La règle des modes (répond à « qui catégorise ? »)

Personne ne choisit un mode : la catégorisation est automatique, entièrement
déterminée par l'interception et son issue.

| `outcome` | Ce qui s'est passé | Mode suggéré côté app |
|---|---|---|
| `improved` | Intercepté, a travaillé avec le dialogue, a envoyé la version améliorée | « Avec le companion » |
| `sent` | Non intercepté : le premier jet passait le seuil | « Direct » (bon premier jet) |
| `sent_anyway` | Intercepté, a décliné l'aide, a envoyé tel quel | « Direct » (aide refusée) |
| `cancelled` | Intercepté, n'a finalement rien envoyé | « Annulé » |

Recommandations aux applications consommatrices :

- Un étudiant déjà autonome qui écrit un prompt riche sort en `sent` : c'est un
  succès, pas un défaut d'accompagnement. Si vous affichez un indicateur,
  préférez le score (`score_before` ou `scores.total`) à un badge binaire
  « avec/sans » ; le mode seul pénalise visuellement les meilleurs.
- Distinguez `sent` de `sent_anyway` dans vos agrégats : le premier est un bon
  premier jet, le second un refus d'aide sur un premier jet faible.
- L'usage d'outils d'IA hors extension n'est pas observable par le plugin : si
  votre application permet une déclaration manuelle, stockez-la de votre côté
  (elle n'a pas vocation à remonter dans le backend du plugin).

## Le schéma `post_event` (miroir d'après)

Une ligne par question réflexive montrée après une réponse de l'IA.

| Champ | Type | Sens |
|---|---|---|
| `id`, `client_event_id`, `user_id`, `ts`, `site` | | Comme `prompt_event`. |
| `post_key` | enum | `explain` (reformuler avec ses mots), `verify` (vérifier un fait), `disagree` (oser le désaccord). |
| `category` | string | Catégorie du prompt d'origine. |
| `answered` | bool | L'étudiant a-t-il répondu à la question réflexive. |
| `answer_words` | int | Longueur de sa réponse. |
| `answer` | string ou null | Sa réponse. **Soumise à consentement** (`post_reflection`). |
| `conv_key` | string ou null | **Soumise à consentement** (`conversation_history`). |

## Consentement : la règle transverse

Quatre catégories, demandées par l'organisation et accordées individuellement
par chaque utilisateur : `prompt_text`, `socratic_dialogue`, `post_reflection`,
`conversation_history`.

- Les indicateurs (scores, catégories, issues, volumes, agrégats) sont toujours
  disponibles : ils suffisent pour piloter.
- Le CONTENU n'est renvoyé que si demandé par l'org ET consenti par
  l'utilisateur **au moment de l'appel**. Champs non consentis : `null`, sans
  erreur.
- La révocation est rétroactive : elle coupe aussi l'accès à l'historique déjà
  stocké côté plugin. Votre pipeline doit accepter qu'un contenu déjà ingéré
  revienne à `null` (et, selon vos engagements RGPD, le purger de votre côté).

## Le score, en deux mots

Barème local (aucun appel réseau pour scorer), versionné (`scoringVersion` 2
actuellement) : 4 rubriques sur 25 (clarté, contexte, itération, esprit
critique), total sur 100, seuil d'interception 40 par défaut (surchargé par
organisation). Des règles anti-contournement empêchent d'acheter le score à
coups de mots-clés. La définition détaillée et discutable du barème est
publiée sur le dashboard (page Méthode).

## Canal 2 : exports CSV

Mêmes noms de colonnes que le schéma ci-dessus, séparateur `;`, BOM UTF-8,
dates ISO 8601.

- **Popup de l'extension** (l'étudiant, ses propres données, généré
  localement) : colonnes `client_event_id, ts, site, category, words,
  score_clarte, score_contexte, score_iteration, score_critique, score_total,
  intercepted, outcome, score_before, score_after, rounds, answers_count,
  mirror_shown, mirror_feedback, conv_key, text`.
- **Dashboard admin** (toute l'organisation, filtré par la même règle de
  consentement) : pages Export, un CSV `prompt_events` et un CSV `post_events`.

## Canal 3 : push (v2, non implémenté)

Une cible de synchronisation configurable par organisation (endpoint + clé)
est envisagée comme extension v2 de ce contrat si un besoin temps réel
apparaît. Elle n'existe pas aujourd'hui : n'attendez pas de webhook, tirez.

## Compatibilité et versionnement du contrat

- Contrat v1.0 (20/07/2026). Les évolutions seront additives : nouveaux champs
  et nouvelles valeurs d'enum possibles (`site`, `category`, `mirror_feedback`
  notamment). Écrivez des parseurs tolérants : ignorez les champs inconnus,
  traitez les valeurs d'enum inconnues comme « autre ».
- Un changement cassant donnerait lieu à une v2 annoncée, jamais silencieuse.
- Le barème de score est versionné indépendamment : comparez les courbes de
  progression à `scoringVersion` constant.
