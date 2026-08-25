# Contrat d'intégration Prompt Tracker (v1.2)

Comment brancher votre application (SI pédagogique, journal réflexif, entrepôt
de données, LMS) sur les données produites par l'extension Prompt Tracker.

Le principe : le plugin reste souverain sur son backend et sur la règle de
consentement ; les applications consomment. Aucune référence à une application
particulière n'existe dans le code du plugin : tout passe par la configuration
d'organisation et par les canaux décrits ici.

## Vue d'ensemble : cinq canaux

| Canal | Pour qui | Sens | Latence | Mise en place |
|---|---|---|---|---|
| 1. API REST (pull) | Toute application serveur | Vous lisez | Le rythme de votre cron (15 min recommandé) | Une clé d'API d'organisation |
| 2. Export CSV | Analyses ponctuelles, tableurs | Vous lisez | Manuelle | Aucune |
| 3. Push vers votre endpoint | Besoin temps réel | Nous écrivons | Réservé à une v2 du contrat | Non implémenté |
| 4. Widgets embarqués (iframe) | Afficher sans rien construire | Vous affichez | Temps réel à chaque rendu | Une clé avec le scope `embed:mint` |
| 5. Bibliothèque de prompts | Proposer vos prompts dans l'extension | **Nous lisons chez vous** | Cache de 6 h | Une URL https publique |

Le canal 3 garde son numéro bien qu'il ne soit toujours pas implémenté : ce
contrat est versionné et additif, renuméroter casserait les références
existantes.

Le canal 5 est le seul où **nous** appelons **vous**. Il est décrit en fin de
document, avec ses garanties de confidentialité — qui sont la raison d'être de
sa conception.

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

### Mesures post-réponse (extension ≥ 0.7.0)

Des **indicateurs**, pas du contenu : le texte de la réponse de l'IA est compté
au moment où il s'affiche, puis oublié. Rétention 12 mois, comme les scores.
Ces champs ne sont pas exposés par l'API v1 pour l'instant.

| Champ | Type | Sens |
|---|---|---|
| `prompt_chars` | int ou null | Longueur du prompt envoyé, en signes. |
| `model` | string ou null | Identifiant **normalisé** contre une liste blanche (`gpt-5.1`, `sonnet-4.5`…). `autre` = libellé lu mais hors catalogue (modèle trop récent, ou agent personnalisé). `null` = non mesurable. Jamais le libellé brut lu dans la page. |
| `model_catalog_version` | int ou null | Version du catalogue au moment de la mesure. Permet de distinguer après coup un retard de catalogue d'un vrai usage d'agent personnalisé. |
| `response_chars` | int ou null | Longueur de la réponse. **Sous-estime fortement** quand la sortie part dans un panneau latéral (ChatGPT Canvas, Claude Artifacts). |
| `response_words` | int ou null | Nombre de mots de la réponse. |
| `latency_ms` | int ou null | Délai jusqu'au premier token **visible** (rendu DOM), pas la latence du modèle. |
| `response_ms` | int ou null | Durée de génération : dernière activité moins premier token. ±1 s. |
| `turn_index` | int ou null | Rang du tour dans la conversation, 0-based. |
| `read_ms` | int ou null | Délai entre la fin d'une réponse et l'envoi du prompt suivant du même fil. La plus fiable des mesures de temps : elle ne dépend d'aucun sélecteur de site. |
| `response_outcome` | enum ou null | `complete`, `timeout`, `hidden` (onglet en arrière-plan), `abandoned`, `not_sent`. |

Trois précautions pour qui exploite ces champs :

1. **Tout est nullable, et le null est fréquent.** Un site dont les repères
   d'interface ne sont pas validés ne mesure rien (aujourd'hui : Mistral et
   Grok). Traiter l'absence comme une donnée, jamais comme un zéro.
2. **`latency_ms` et `response_ms` sont nuls si l'onglet est passé en
   arrière-plan** (`response_outcome = "hidden"`) : le navigateur y gèle le
   rendu, la durée mesurée deviendrait « temps passé ailleurs ». Les tailles,
   elles, restent justes.
3. **Aucune de ces durées n'est comparable entre sites** : elles mesurent des
   pipelines de rendu différents. Seules les tendances intra-site et
   intra-utilisateur sont honnêtes.

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

Barème local (aucun appel réseau pour scorer), versionné (`scoringVersion` 3
depuis le 25/08/2026) : 4 rubriques sur 25 (clarté, contexte, itération, esprit
critique), total sur 100, seuil d'interception 40 par défaut (surchargé par
organisation). Des règles anti-contournement empêchent d'acheter le score à
coups de mots-clés. La définition détaillée et discutable du barème est
publiée sur le dashboard (page Méthode).

**v3 — correction de parité entre langues.** Les frontières de mot du moteur
raisonnaient en ASCII : les mots français à initiale accentuée (« écris »,
« évalue », « étapes », « à destination de ») n'étaient jamais reconnus, et
deux verbes d'action anglais manquaient à l'appel (« draft », « do »). Des
prompts strictement équivalents obtenaient donc des scores différents selon la
langue — dans les deux sens. Les scores concernés **montent**, jamais ils ne
descendent : une courbe de progression qui traverse cette date se lit à
`scoringVersion` constant. Le banc de parité qui verrouille la correction vit
dans `extension/tests/scoring-eval.js`.

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

## Canal 4 : widgets embarqués (iframe à jeton signé)

Pour afficher la progression dans votre ENT sans construire de front. Quatre
graphiques, aux couleurs de l'organisation :

| Widget | Portée | Contenu |
|---|---|---|
| `class-progress` | `group`, `org` | Courbe des premiers jets par semaine |
| `student-progress` | `student` | La même, pour un élève |
| `outcome-mix` | `group`, `student`, `org` | Répartition `sent` / `improved` / `sent_anyway` / `cancelled` |
| `rubric-averages` | `group`, `student`, `org` | Moyennes des quatre rubriques |

**Garantie de non-fuite : ces widgets n'affichent que des indicateurs.** Aucun
ne peut exposer `text`, `dialogue`, `answer` ni `conv_key`, quels que soient
les consentements accordés. La règle de consentement du canal 1 ne s'applique
donc pas ici — il n'y a rien à filtrer. C'est un choix de conception, pas une
configuration : un widget embarqué chez un tiers ne peut pas devenir une fuite
de contenu.

Marche à suivre, à chaque rendu de page **côté serveur** :

1. `POST /api/v1/embed-tokens` avec votre clé (scope `embed:mint`), le widget
   et la portée. Réponse : `{ token, expires_at, url }`.
2. `<iframe src="<url>" width="100%" height="320" style="border:0">`.

Le jeton est un JWS HS256, valable 15 minutes par défaut (60 s à 1 h). Frappez-le
à chaque rendu plutôt que de le mettre en cache : sa brièveté est ce qui borne
l'impact d'une fuite. L'URL ne porte **qu'une capacité signée** — ni identifiant
d'organisation, ni identifiant d'élève, ni adresse, ni nom de classe en clair.

Deux verrous côté serveur :

- **Origines déclarées.** Le widget n'est encadrable que par les origines
  saisies dans Paramètres → Widgets embarquables (`frame-ancestors`). Liste
  vide = affichable nulle part, y compris chez vous : l'échec est fermé.
- **Révocation.** Révoquer la clé qui a frappé un jeton tue les widgets
  correspondants au rendu suivant. Pour tout invalider d'un coup quelle que
  soit la clé, renouvelez le secret de signature depuis le dashboard.

Le scope `embed:mint` n'est jamais attribué d'office : les clés créées avant la
v1.1 ne l'ont pas, créez-en une nouvelle.

## Canal 3 : push (v2, non implémenté)

Une cible de synchronisation configurable par organisation (endpoint + clé)
est envisagée comme extension v2 de ce contrat si un besoin temps réel
apparaît. Elle n'existe pas aujourd'hui : n'attendez pas de webhook, tirez.

## Canal 5 : bibliothèque de prompts (nous lisons chez vous)

Votre organisation publie un JSON ; l'extension le propose à l'ouverture du
dialogue socratique, sous « Partir d'un prompt qui a fonctionné ». Deux niveaux
sont prévus : les pré-prompts officiels de votre équipe pédagogique, et les
prompts que vos apprenants partagent entre eux.

### Ce que l'extension envoie : rien

C'est le point de conception, pas un détail d'implémentation.

- Requête `GET`, **`credentials: "omit"`** : aucun cookie, aucune session.
- **Aucun en-tête d'authentification**, aucun jeton, aucune clé.
- **Aucun paramètre dérivé du compte** : ni identifiant, ni courriel, ni
  organisation, ni prompt, ni score. L'URL est appelée exactement telle que
  vous l'avez configurée.

Conséquence pour vous : cette URL doit être **publique en lecture**, et ne
contenir que ce que vous acceptez de publier. Nous ne pouvons pas
l'authentifier sans faire circuler un secret partagé dans l'extension de chaque
apprenant, ce que nous refusons de faire.

Conséquence pour vos journaux : vous verrez des requêtes anonymes, sans moyen
de les rattacher à un apprenant. C'est voulu — l'appel ne doit rien révéler de
qui l'émet.

### Permission d'hôte : facultative, jamais d'office

L'extension déclare `optional_host_permissions` et ne demande l'accès qu'à
**votre origine**, depuis un clic de l'utilisateur dans la popup. Tant que la
permission n'est pas accordée, aucune requête n'est tentée. L'apprenant peut
refuser : le reste de l'extension fonctionne à l'identique.

### Format v1

```json
{
  "version": 1,
  "updated_at": "2026-08-25T10:00:00Z",
  "prompts": [
    {
      "id": "sov-01",
      "kind": "official",
      "lang": "fr",
      "title": "Cadrer une dissertation",
      "body": "Je prépare une dissertation sur [SUJET]…",
      "category": "rédaction",
      "author": "Équipe pédagogique",
      "copies": 42,
      "helpful": 7
    }
  ]
}
```

| Champ | Obligatoire | Rôle |
|---|---|---|
| `body` | **oui** | Le prompt lui-même. Une entrée sans `body` est ignorée. |
| `id` | non | Votre identifiant. À défaut, un rang est attribué. |
| `title` | non | Titre affiché. À défaut, les 60 premiers caractères du `body`. |
| `kind` | non | `official` (défaut) ou `peer`. Les officiels sont listés en premier. |
| `lang` | non | `fr` ou `en`. **Filtrant** : une entrée déclarée dans une autre langue que celle du prompt en cours n'est pas proposée. Omettez-le pour qu'elle soit toujours visible. |
| `category` | non | Texte libre affiché tel quel. Les catégories du barème (`code`, `rédaction`, `résumé`, `traduction`, `analyse`, `brainstorming`, `recherche`) restent le vocabulaire recommandé. |
| `author` | non | Affiché après la nature. Répéter le libellé de nature n'ajoute rien : il est alors masqué. |
| `copies`, `helpful` | non | Entiers positifs. Servent au tri des entrées `peer`, les plus reprises d'abord. |

### Bornes appliquées à la lecture

Tout ce qui vient du réseau est traité comme hostile. L'extension applique,
sans erreur visible pour l'apprenant :

- **256 Ko** de charge utile maximum, **200 prompts** maximum ;
- `body` tronqué à 4000 caractères, `title` à 120, `author` à 80 ;
- champs inconnus **ignorés** — le format peut grandir sans casser les clients
  déjà déployés ;
- délai de 4 s, **cache de 6 h**, repli silencieux sur le cache en cas
  d'échec : une bibliothèque indisponible ne dégrade jamais le dialogue.

### Configuration

Dashboard → Paramètres → *Comportement de l'extension* → **Bibliothèque de
prompts (URL)**. `https://` obligatoire, contrainte portée aussi par la base.
Vider le champ retire la bibliothèque et purge le cache local des apprenants.

## Compatibilité et versionnement du contrat

- Contrat v1.1 (16/08/2026) : ajout du canal 4 (widgets embarqués) et du scope
  `embed:mint`. **Strictement additif** — aucun champ, aucune sémantique et
  aucun numéro de canal existants n'ont changé. Un intégrateur v1.0 n'a rien à
  faire.
- Contrat v1.0 (20/07/2026). Les évolutions seront additives : nouveaux champs
  et nouvelles valeurs d'enum possibles (`site`, `category`, `mirror_feedback`
  notamment). Écrivez des parseurs tolérants : ignorez les champs inconnus,
  traitez les valeurs d'enum inconnues comme « autre ».
- Un changement cassant donnerait lieu à une v2 annoncée, jamais silencieuse.
- Le barème de score est versionné indépendamment : comparez les courbes de
  progression à `scoringVersion` constant.
