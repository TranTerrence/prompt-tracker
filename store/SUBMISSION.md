# Réponses de soumission — Chrome Web Store

Les champs du Developer Dashboard, écrits une fois et recopiés **verbatim** à
chaque envoi. Les réécrire à chaque fois est le principal moyen de se contredire
d'une version à l'autre — une incohérence entre deux soumissions est un motif de
rejet, et pire, de retrait après publication.

Toute modification du code qui change une réponse ci-dessous doit modifier ce
fichier **dans le même commit**.

---

## Objectif unique (single purpose)

> I-BE³ Companion aide l'utilisateur à améliorer la qualité de ses prompts sur
> les interfaces de chat IA (ChatGPT, Claude, Gemini, Mistral, Grok) : il le
> fait réfléchir avant l'envoi — au besoin en lui montrant des prompts
> éprouvés — et lui restitue l'effet obtenu.

Une seule phrase, un seul verbe. Toute fonctionnalité qui ne se rattache pas à
cette phrase doit être retirée ou la phrase réécrite — le Store rejette les
extensions « couteau suisse ».

> **Réécrite en 0.7.0.** La formulation précédente était bornée à « avant
> l'envoi ». Les mesures post-réponse (longueur, durée, modèle, délai de
> lecture) débordaient donc l'objectif déclaré. Elles servent pourtant la même
> finalité — montrer à l'utilisateur ce que ses prompts produisent — d'où la
> reformulation autour de « améliorer la qualité de ses prompts », qui couvre
> les deux moments sans devenir une liste de fonctionnalités.

> **Amendée en 0.8.0, et la tension mérite d'être nommée.** La bibliothèque de
> prompts publiée par un établissement pose une vraie question : montrer un
> prompt tout fait ne « fait pas réfléchir », cela dispenserait plutôt de le
> faire. Ce qui la garde dans l'objectif unique est sa POSITION, pas son
> intention : elle n'existe qu'à l'intérieur du dialogue d'interception, repliée
> par défaut, et un prompt choisi atterrit dans le même aperçu éditable, re-scoré
> à chaque frappe, que l'utilisateur doit toujours valider lui-même. Elle ne
> court-circuite ni l'interception ni l'envoi : c'est un point de départ à
> adapter, pas un raccourci. D'où l'incise « au besoin en lui montrant des
> prompts éprouvés », qui la rattache au moment d'avant-envoi sans faire de la
> phrase une liste de fonctionnalités.
>
> **Amendée en 0.9.0 — et 0.8.0 disait le contraire, il faut l'assumer.** La
> 0.8.0 écrivait ici qu'une bibliothèque accessible depuis la popup ferait
> tomber l'argument et devrait partir. La popup 0.9.0 la propose pourtant, et
> voici pourquoi l'objectif tient quand même : ce qui rattache la bibliothèque
> à « faire réfléchir avant l'envoi » n'est pas sa position dans l'interface,
> c'est qu'elle ne COURT-CIRCUITE jamais la réflexion. La liste de la popup est
> une lecture : cliquer copie le prompt dans le presse-papiers, rien n'est
> injecté dans aucune page, rien n'est envoyé. Un prompt collé dans un chat
> redevient un brouillon comme un autre — scoré localement, intercepté sous le
> seuil, soumis au même dialogue. L'incise « au besoin en lui montrant des
> prompts éprouvés » couvrait déjà ce geste ; ce qui était faux en 0.8.0,
> c'était d'ancrer la garantie dans la géographie de l'interface plutôt que
> dans le circuit de l'envoi. Le critère qui ferait vraiment partir la
> fonctionnalité reste écrit : le jour où la bibliothèque INJECTE ou ENVOIE un
> prompt à la place de l'utilisateur, elle sort de l'objectif unique.

## Justification des permissions

Recopier ces textes dans le champ « justification » de chaque permission.

| Permission | Justification à coller |
|---|---|
| `storage` | Stocke localement les réglages de l'utilisateur (seuil, thème, consentements) et l'historique de ses scores de prompts, qui alimente le tableau de bord de progression affiché dans la popup. Aucune de ces données ne quitte l'appareil sans consentement explicite. |
| `alarms` | Planifie la synchronisation périodique en arrière-plan pour les utilisateurs dont le compte est lié (l'organisation est rattachée au compte créé par le programme, il n'y a plus de jonction séparée). Sans elle, les indicateurs consentis ne remonteraient qu'à l'ouverture de la popup. |
| `host_permissions` : `` `https://companion.mines.paris/*` `` | **Obligatoire depuis la 1.0.2, une seule origine — celle de l'app du programme, déjà nommée partout ailleurs dans cette fiche.** Deux usages, tous deux confinés à ce domaine : (1) injecter `src/presence.js` à `document_start`, qui annonce dans le DOM de la page l'état d'installation (armée, liée, dernière sync, file en attente) — la réponse immédiate, côté navigateur, à « l'extension est-elle installée ? » ; (2) lire par défaut le flux de pré-prompts de l'app elle-même (`GET {APP_URL}/api/prompt-library`) quand l'établissement n'a rien publié à sa propre adresse, sans passer par la permission facultative ci-dessous. Le battement de présence lui-même écrit vers l'hôte Supabase, pas vers ce domaine : voir plus bas, section 1.0.2. |
| `optional_host_permissions` : `https://*/*` | **Facultative, jamais accordée à l'installation.** Un établissement scolaire peut publier une bibliothèque de prompts pédagogiques à sa propre adresse ; l'extension ne peut pas connaître cette adresse à l'avance, elle varie d'un établissement à l'autre. Elle n'est donc PAS déclarée dans `host_permissions` : elle est demandée à l'exécution, par `chrome.permissions.request`, sur la **seule origine** configurée par l'établissement de l'utilisateur, et uniquement après un clic explicite de celui-ci dans la popup. Tant que l'utilisateur n'accorde rien, aucune requête n'est émise. L'appel est une simple lecture `GET` en `credentials: "omit"`, sans en-tête d'authentification et sans aucun paramètre dérivé du compte : aucune donnée utilisateur ne part vers cet hôte. Refuser la permission ne dégrade aucune autre fonction. |

**Match patterns des content scripts** (`chatgpt.com`, `chat.openai.com`,
`claude.ai`, `gemini.google.com`, `chat.mistral.ai`, `grok.com`,
`companion.mines.paris`) :

> L'extension doit lire le champ de saisie et intercepter l'envoi sur les cinq
> interfaces de chat IA pour proposer sa question de réflexion avant que le
> prompt ne parte. Elle observe ensuite la zone de réponse pour en mesurer la
> longueur et la durée d'affichage, et lire le nom du modèle : c'est ce qui
> permet de montrer à l'utilisateur l'effet de ses prompts. Le texte de la
> réponse est compté puis oublié — il n'est ni stocké ni transmis. Chaque
> domaine est listé explicitement ; aucune permission large (`<all_urls>`,
> `*://*/*`) n'est demandée.
>
> **`companion.mines.paris` (depuis la 1.0.2) est un sixième domaine, mais un
> script différent** : `src/presence.js`, à `document_start`, sans aucune
> interception. Il ne lit ni n'écrit rien de la page ; il pose un attribut DOM,
> un `CustomEvent` et un `postMessage` (origine explicite, jamais `"*"`) qui
> portent l'état d'installation décrit dans la permission d'hôte ci-dessus.
> Seul le message `{ source: "ibe3-companion", type: "status?" }`, reçu sur
> `location.origin`, déclenche une réponse ; rien d'autre de la page n'est lu.

**Remote code : NON.** Tout le JavaScript est dans le paquet. `supabase.js` est
un client HTTP écrit à la main (`fetch`), pas un SDK chargé depuis un CDN.
L'appel à Anthropic transmet des *données* et reçoit du *texte* — jamais de code
exécutable.

## Divulgation de l'usage des données

Cocher exactement ceci — et rien de plus :

| Catégorie | Collectée ? | Pourquoi |
|---|---|---|
| Informations personnelles identifiables | **Oui** — email | Identifie l'étudiant auprès de son programme, uniquement après appairage du compte |
| Activité de l'utilisateur | **Oui** | Scores, catégorie, nombre de mots, issue, plus les mesures de réponse (longueur, durée de génération, modèle utilisé, délai avant le prompt suivant) — le cœur du tableau de bord. Depuis la 1.0.2, une fois le compte lié, l'état d'installation s'y ajoute : version de l'extension, indice de navigateur, heure de la dernière synchronisation réussie et nombre d'événements en attente — six colonnes dans `extension_devices`, jamais de contenu |
| Contenu du site web | **Oui** | Le texte du prompt, **seulement** si l'utilisateur active l'option et consent catégorie par catégorie |
| Informations d'authentification | **Non** | Depuis la 1.0.0, aucun mot de passe ne transite par l'extension : le formulaire e-mail / mot de passe a été retiré du popup, `CoachApi.login()` / `signup()` n'existent plus (`token?grant_type=password` et `signup` ne sont plus appelés). La seule entrée est l'appairage par code, approuvé sur l'app où l'utilisateur est déjà connecté ; l'extension ne reçoit qu'un jeton de session (`redeem_pairing`), qu'elle rafraîchit ensuite. Voir la note 0.7.0 plus bas : la condition qu'elle posait pour revenir à « Non » est remplie. |
| Santé, financier, localisation, communications personnelles | **Non** | — |

**Le texte de la réponse de l'IA n'est pas collecté.** Il est lu dans la page
pour être compté (nombre de signes, nombre de mots) puis immédiatement oublié :
il n'est ni stocké localement, ni transmis, ni journalisé. Au sens du Store,
« collecter » signifie transmettre hors de l'appareil — ce n'est donc pas une
collecte, et cocher « contenu du site web » pour cette raison serait une
déclaration fausse dans l'autre sens. Le code correspondant est
`readResponseText()` dans `extension/src/adapters/factory.js` : sa valeur de
retour ne sert qu'à deux compteurs et n'est affectée à aucun objet persisté.

**Le nom du modèle est normalisé avant enregistrement.** Un libellé lu dans la
page peut contenir du texte écrit par un utilisateur (un GPT personnalisé porte
le nom que son auteur lui a donné). `extension/src/models.js` le compare à une
liste blanche et n'enregistre qu'un identifiant connu, `"autre"`, ou rien —
jamais le libellé lu. Une contrainte serveur (`prompt_events_model_slug`)
rejette toute valeur qui ne serait pas un identifiant court.

Les trois certifications à cocher sont vraies et doivent le rester : pas de
vente à des tiers, pas d'usage étranger à l'objectif unique, pas d'usage pour
déterminer une solvabilité.

**Politique de confidentialité :** https://companion.mines.paris/extension/privacy
(doit répondre 200 et nommer l'extension — vérifié par `scripts/webstore-check.sh`).

## Notes au relecteur (champ « Testing instructions »)

Sans ceci, le relecteur ne voit qu'une extension inerte et rejette pour
« fonctionnalité insuffisante » — l'extension ne fait rien tant que l'écran de
divulgation n'est pas accepté.

> L'extension reste volontairement inactive tant que l'écran de divulgation
> affiché à l'installation n'a pas été accepté. Pour tester :
>
> 1. Installer, puis cliquer « J'accepte et j'active » sur l'écran d'onboarding.
> 2. Ouvrir https://chatgpt.com et saisir un prompt volontairement vague, par
>    exemple « fais mes devoirs ».
> 3. À l'envoi, un dialogue s'ouvre à la place du message : c'est la
>    fonctionnalité principale. « Envoyer quand même » laisse toujours partir
>    le prompt d'origine.
> 4. La popup de l'extension montre le tableau de bord des scores.
>
> **Aucun compte n'est nécessaire pour tester la fonctionnalité principale** :
> les étapes 1 à 4 se font entièrement hors ligne, toute l'analyse est locale.
>
> **Pour tester la liaison de compte et le partage** (optionnel), un compte
> de test est provisionné sur l'application du programme :
>
> - Application : https://companion.mines.paris/login
> - Identifiant : <À FOURNIR AVANT ENVOI>
> - Mot de passe temporaire : <À FOURNIR AVANT ENVOI>
>
> 5. Se connecter sur https://companion.mines.paris/login avec ce compte.
> 6. Dans le popup de l'extension, cliquer « Lier mon compte » : un onglet
>    s'ouvre sur `https://companion.mines.paris/extension/pair?c=XXXX` avec le
>    code déjà rempli ; vérifier qu'il correspond à celui du popup, puis
>    « Autoriser ». Le popup se met à jour seul (« Tout est synchronisé »).
>    Aucun mot de passe n'est saisi dans l'extension : c'est la seule entrée,
>    il n'y a pas de formulaire de connexion ni d'inscription dans le popup.
> 7. Ouvrir https://companion.mines.paris/companion dans le même onglet : la
>    page montre déjà l'extension comme **installée et liée**, sans attendre
>    l'envoi d'un prompt. C'est le battement de présence (`extension_devices`,
>    côté serveur) et l'annonce de `src/presence.js` (côté navigateur) qui
>    l'alimentent, nouveauté de la 1.0.2 (voir plus bas).
> 8. Envoyer un prompt vague sur https://chatgpt.com : le dialogue s'ouvre ;
>    répondre à une ou deux questions, envoyer. Le prompt et son dialogue
>    apparaissent dans https://companion.mines.paris/prompts.
> 9. « 🔒 Mes données partagées » (popup) ouvre les réglages de partage,
>    interrupteurs de contenu désactivés par défaut.
>
> **Il n'existe pas de code de classe ni d'inscription libre.** Les comptes
> sont créés par le programme avec leur organisation déjà rattachée : il n'y
> a rien à saisir ni à rejoindre côté étudiant.
>
> **À propos de la permission d'hôte facultative `https://*/*` (nouveauté 0.8.0).**
> Elle n'est **jamais accordée à l'installation** : vous pouvez le constater sur
> `chrome://extensions` → Détails → « Accès au site », qui reste vide après une
> installation neuve. L'extension ne demande jamais `https://*/*` : le seul
> appel à `chrome.permissions.request` se trouve dans `popup/popup.js`
> (fonction du bouton « Activer la bibliothèque ») et passe l'**origine exacte**
> publiée par l'établissement de l'utilisateur, jamais un motif large.
>
> Cette fonction est **invisible sans compte lié**, et c'est voulu : la
> carte d'activation ne s'affiche que si l'organisation de l'utilisateur a
> renseigné une adresse de bibliothèque. Sans compte, il n'y a donc rien à voir,
> et aucune requête n'est jamais émise. Le chemin complet est lisible dans le
> code, en trois fichiers :
>
> - `src/supabase.js` → `refreshOrgConfig()` : redescend `library_url` depuis la
>   configuration de l'organisation ;
> - `popup/popup.js` → `renderLibraryOffer()` puis le clic sur
>   `#library-enable` : demande la permission sur cette seule origine ;
> - `src/background.js` → `loadLibrary()` : lit l'adresse en
>   `credentials: "omit"`, **sans en-tête d'authentification et sans aucun
>   paramètre dérivé du compte**. C'est une lecture, jamais un envoi : aucune
>   donnée de l'utilisateur ne part vers cet hôte. La réponse est bornée
>   (256 Ko, 200 entrées), affichée en `textContent` et jamais évaluée.
>
> Depuis la 0.9.0, la même liste (déjà récupérée par ce canal) est aussi
> consultable dans la popup, en lecture seule : rendue en `textContent`,
> cliquer copie le prompt dans le presse-papiers, localement. Aucune requête
> supplémentaire, aucune injection dans une page, aucun envoi.

⚠️ Remplacer les deux `<À FOURNIR AVANT ENVOI>` par le compte de test créé
sur companion.mines.paris (`/admin/users`, rôle étudiant, mot de passe temporaire),
ou supprimer les étapes 5 à 9. Un relecteur bloqué sur un login rejette sans
appel. Le compte doit exister AVANT la soumission et survivre à la revue
(2 à 7 jours) : ne pas le supprimer avec les comptes de démonstration.

### Ce que le passage en 1.0.2 change pour la revue

- **Une permission d'hôte obligatoire de plus, et une bulle de re-consentement.**
  `` `https://companion.mines.paris/*` `` rejoint `host_permissions` — elle n'y
  était pas avant : l'app n'était atteinte que par des liens sortants et par le
  canal facultatif `https://*/*`. Chrome affiche donc, à la mise à jour, l'écran
  habituel de nouvelle permission, sur une seule origine, celle déjà nommée
  partout ailleurs dans cette fiche, jamais un motif large.
  `optional_host_permissions` (`https://*/*`) est inchangée.
- **Battement de présence côté serveur, table `extension_devices`.**
  `heartbeat()` (`src/supabase.js`) upserte exactement six colonnes —
  `user_id`, `device_id`, `version`, `browser_hint`, `last_sync_at`,
  `pending_count` — avec le jeton de SESSION de l'utilisateur, exactement
  comme les écritures dans `prompt_events` : pas de clé de service, pas de
  RPC. Côté serveur (dépôt de l'app), la table est sous RLS, les quatre verbes
  restreints à `user_id = auth.uid()` — aucune politique tuteur, aucune
  politique admin. `last_seen_at` est estampillé par un trigger serveur,
  jamais envoyé par le client. L'écriture part vers l'hôte Supabase déjà
  utilisé pour tout le reste (`kbbrkrvacazkxraudvng.supabase.co`), pas vers
  `companion.mines.paris` : ce canal n'ajoute donc aucune permission d'hôte
  nouvelle. Un battement raté ne lève jamais et n'écrit jamais `syncStatus`
  (qui pilote la bannière et le badge) : ne jamais lire un battement absent
  comme une preuve d'échec de synchronisation.
- **Présence limitée à l'origine de l'app.** `src/presence.js`, injecté à
  `document_start` sur `companion.mines.paris` uniquement (nouvelle entrée
  `content_scripts` dans le manifest), pose un attribut DOM, un `CustomEvent`
  et un `postMessage` (origine explicite, jamais `"*"`) qui disent à la page
  si l'extension est armée, liée, et où en est sa dernière synchronisation —
  rien d'autre n'est lu sur cette page. Les cinq sites d'IA ne chargent
  toujours aucun script de présence et restent indétectables.
  **Nuance de la ligne « indétectable » de la 0.7.0** (corrigée sur place,
  voir cette section plus bas) : c'est désormais vrai pour toute page tierce,
  mais plus pour l'origine de l'app elle-même, qui est la nôtre.
- **Le flux par défaut de la bibliothèque change quand une organisation ne
  publie rien.** `library_url` à `NULL` ne coupe plus la bibliothèque :
  `refreshOrgConfig()` (`src/supabase.js`) retombe sur `defaultLibraryUrl()`,
  `{APP_URL}/api/prompt-library`, servie par l'app elle-même et déjà lisible
  sans rien demander de plus puisque `companion.mines.paris` est désormais une
  permission d'hôte obligatoire. Contrepartie assumée : une organisation ne
  peut plus désactiver la bibliothèque en laissant le champ vide, elle doit la
  remplacer explicitement pour la couper.
- **Divulgation version 3** (`DISCLOSURE_VERSION`, `popup.js` et
  `onboarding.js`) : une fois le compte lié, le texte dit maintenant que
  l'état d'installation (version, navigateur, dernière sync, file en attente)
  part vers l'app. Les comptes ayant déjà accepté voient un bandeau
  d'information non bloquant au prochain ouverture du popup — même motif
  qu'en 0.7.0, aucun retour en veille.
- **Popup : deux boutons au lieu d'un.** « Ouvrir l'app » vise désormais
  `/companion` (la page qui montre justement cet état d'installation) au lieu
  de la racine ; un second bouton ouvre `/prompts`. La déconnexion garde sa
  propre ligne (trois boutons de front rendaient les libellés illisibles dans
  360 px).
- **Aucune nouvelle catégorie de données.** Le tableau de divulgation
  ci-dessus est mis à jour (ligne « Activité de l'utilisateur ») pour nommer
  l'état d'installation ; aucune ligne ne passe de Non à Oui.

### Ce que le passage en 1.0.1 change pour la revue

- **Quatre changements, aucun sur les permissions ni les données.**
- **L'adresse de l'app.** `CoachConfig.APP_URL`
  (`src/config.js`) passe de `https://ibe3.vercel.app` à
  `https://companion.mines.paris`, le domaine du programme depuis le
  16 septembre 2026. Tous les liens sortants en dérivent (méthode
  `/help#method`, politique `/extension/privacy`, appairage
  `/extension/pair?c=…`, bouton « Ouvrir l'app ») et les deux appels réseau
  vers l'app aussi (`/api/tracker/pair`, `/api/tracker/socratic`). Même
  application, même code serveur, même base Supabase
  (`kbbrkrvacazkxraudvng`, Paris) : `ibe3.vercel.app` reste un alias Vercel du
  même projet et continue de répondre, il n'est simplement plus l'adresse
  que l'on donne aux étudiants.
- **Pourquoi maintenant.** L'app a pris son domaine définitif et sa connexion
  par le compte de l'école (OpenID Connect) ne redirige que vers
  `companion.mines.paris` : un relecteur ou un étudiant envoyé sur l'alias
  est redirigé vers le domaine pour se connecter. Le paquet 1.0.0 fonctionnait
  grâce à cette redirection ; la 1.0.1 va directement au bon endroit.
- **Un sélecteur de plus pour ChatGPT** (`src/adapters/chatgpt.js`) :
  la coquille servie aux visiteurs non connectés sur chatgpt.com (constatée
  le 16/09/2026) porte un `<textarea id="mobile-composer-prompt">` sans
  ProseMirror ; sans ce sélecteur, l'extension ne trouvait pas le champ,
  affichait son badge ⚠ et laissait tout passer sur cette page. Même
  lecture du DOM qu'avant, même site déjà déclaré dans les `matches`.
  C'est ce qui a permis de produire la capture 3 sur une interception
  réelle, sans compte ChatGPT — un relecteur non connecté verra donc la
  fonction principale.
- **L'onboarding ne demande plus « Ton usage principal »** (étudiant /
  consultant / salarié / autre). L'extension est destinée aux étudiants du
  programme : le profil est fixé à `student` (`DEFAULT_SETTINGS` de
  `src/content.js`), ce qui ne change que le vocabulaire des questions
  (« ton devoir »). Ce choix n'était jamais transmis nulle part ; un écran
  de moins pour le relecteur avant le bouton d'activation.
- **L'interface est en anglais pour tout le monde** (`CoachI18n.lang = "en"`
  dans `src/i18n.js`, `default_locale` du manifest en `en`), comme l'app
  companion.mines.paris vers laquelle mène chaque lien : pas deux langues
  d'un écran à l'autre. Les questions du coaching suivent toujours la langue
  du prompt (un prompt français reçoit des questions en français). Les
  chaînes françaises restent dans le paquet pour le jour où l'app est
  traduite. Les captures sont en anglais, comme le paquet.
- **Rien d'autre ne bouge.** `manifest.json` : `version` (1.0.0 → 1.0.1) et
  `default_locale` (fr → en). Permissions identiques (`storage`, `alarms`, la permission
  d'hôte facultative), mêmes cinq `matches`, mêmes fichiers dans le paquet.
  Aucune donnée nouvelle, aucune catégorie nouvelle, aucun hôte nouveau
  (le domaine remplace l'alias, il ne s'y ajoute pas), aucun code distant.
  `DISCLOSURE_VERSION` inchangé. La divulgation ci-dessus est recopiée telle
  quelle ; seule l'URL de la politique de confidentialité change de domaine
  (l'ancienne répond toujours).

### Ce que le passage en 1.0.0 change pour la revue

- **Nouveau nom, même fiche, même identifiant.** « Prompt Tracker » devient
  **« I-BE³ Companion »** (`_locales/{fr,en}/messages.json`, `manifest.json`
  `action.default_title`, popup, onboarding, consentement, modale). C'est une
  mise à jour de l'élément existant, pas un nouvel envoi : l'ID de l'extension
  et l'historique de la fiche sont conservés. Le nom ne contient aucune marque
  tierce.
- **Backend changé, pas la fonctionnalité.** L'extension ne parle plus au
  projet Supabase autonome de Prompt Tracker (`ovbvwawzrciwpudnaysp`) mais à
  la base du programme I-BE³ Companion, Supabase hébergé à Paris
  (`kbbrkrvacazkxraudvng.supabase.co`) : même surface PostgREST / GoTrue,
  mêmes RPC d'appairage et de consentement (`create_pairing_request`,
  `redeem_pairing`, `ack_baseline_consent`, `purge_my_content`…). Les deux
  Edge Functions (`pair-extension`, `socratic-llm`) sont deux routes de l'app
  (`/api/tracker/pair`, `/api/tracker/socratic`), même contrat. Le bouton
  « Lier mon compte » ouvre `https://ibe3.vercel.app/extension/pair` au lieu
  de l'ancien dashboard `track-prompt.vercel.app`, qui disparaît.
- **Le formulaire e-mail / mot de passe est retiré.** Plus de
  `<details id="auth-fallback">` dans `popup/popup.html`, plus de
  `handleAuth()` dans `popup.js`, plus de `CoachApi.login()` / `signup()` dans
  `src/supabase.js` (rien d'autre ne les appelait ; `background.js` vérifié).
  Conséquence directe sur la divulgation : **« Informations
  d'authentification » repasse à Non**, condition posée dans la note 0.7.0
  ci-dessous. L'appairage par code est la seule entrée ; l'inscription libre
  est fermée côté serveur (Supabase → « Allow new users to sign up » OFF).
- **Les codes de classe disparaissent.** Les comptes sont créés par le
  programme avec leur organisation déjà rattachée : il n'y a plus rien à
  « rejoindre ». Le champ de code et son bouton sont retirés du popup, ainsi
  que leurs chaînes FR/EN. `CoachApi.joinGroup` reste dans `supabase.js` (le
  RPC `join_group_with_code` répond `{"status":"not_available"}`) mais plus
  rien ne l'appelle : code mort documenté comme tel. Le vocabulaire de
  l'interface suit (« ton tuteur CARE », « l'app I-BE³ Companion », plus de
  « classe » ni d'« enseignant »).
- **Tous les liens sortants pointent sur l'app du programme**, dérivés d'une
  seule constante (`CoachConfig.APP_URL`, `src/config.js`) : méthode et barème
  `https://ibe3.vercel.app/help#method` (popup, tuile score, « ? » de la
  modale), politique de confidentialité
  `https://ibe3.vercel.app/extension/privacy` (popup, onboarding), accueil de
  l'app (bouton « Ouvrir l'app I-BE³ Companion »).
- **Permissions : inchangées, moins les hôtes de développement.**
  `optional_host_permissions` revient à `["https://*/*"]` seul : les deux
  entrées `http://localhost:3200/*` et `http://127.0.0.1:54421/*` qui
  servaient à la vérification locale sont retirées du manifest. `storage` +
  `alarms` et les cinq `matches` de content scripts sont identiques. Les
  content scripts chargent en plus `src/config.js` : un objet de trois
  constantes (URL Supabase, clé publishable, URL de l'app), sans fonction ni
  requête, dont ils ne lisent qu'`APP_URL` pour le lien « ? » de la modale.
  Le client REST/Auth (`src/supabase.js`) n'est pas chargé dans les pages
  des sites IA : il reste confiné au worker, au popup et à la page de
  consentement, comme avant.
- **Vue construite de la modale.** La colonne de droite montre le prompt en
  train de se fabriquer (demande d'origine, puis un bloc par réponse), avec
  « modifier le texte » pour voir et éditer les octets bruts. Même contenu
  qu'avant, autre présentation ; le texte envoyé est strictement celui
  affiché (verrouillé par `tests/scoring.test.js`).
- **Aucune nouvelle catégorie de données, aucune nouvelle destination
  autre que l'hébergeur.** Les mêmes indicateurs partent vers le même type de
  plateforme (PostgREST / GoTrue derrière RLS) ; l'hébergeur est Supabase
  (Paris), l'app tourne sur Vercel (Paris). La politique de confidentialité
  de l'app le dit explicitement. `DISCLOSURE_VERSION` inchangé : le texte de
  divulgation change de vocabulaire (compte lié, tuteur), pas de périmètre.

### Ce que le passage en 0.9.1 change pour la revue

- **Aucune permission ne change.** Le manifest reste à `storage` + `alarms`,
  plus la permission d'hôte facultative inchangée.
- **Correction d'un défaut d'installation visible par le relecteur.** Chrome
  n'injecte les content scripts que dans les onglets chargés APRÈS
  l'installation : un relecteur qui garde son onglet ChatGPT ouvert pendant
  qu'il charge l'extension ne voit RIEN se passer, et peut conclure que la
  fonctionnalité annoncée est absente. La page de bienvenue et la popup
  détectent maintenant ces onglets et proposent un bouton « Recharger ces
  onglets ».
- **Les API d'onglets utilisées ne requièrent pas la permission `tabs`.**
  `chrome.tabs.reload` n'en demande aucune ; `chrome.tabs.query` (filtre `url`)
  et `chrome.tabs.sendMessage` sont couverts par les permissions d'hôte que les
  `matches` de `content_scripts` accordent déjà sur les cinq sites déclarés —
  les mêmes, ni plus ni moins. Aucun autre onglet n'est ni listé, ni lu, ni
  interrogé. Même logique que `chrome.tabs.create` en 0.7.
- **Le rechargement n'est jamais automatique** : il n'a lieu qu'au clic
  explicite de l'utilisateur, et se limite aux onglets détectés.
- **Aucune donnée nouvelle, aucun hôte nouveau, aucun code distant.** Le message
  échangé avec les onglets est un ping vide (`{ type: "coach-ping" }`) dont la
  seule réponse possible est `{ ok: true }` : aucun contenu de page n'est lu.
  `DISCLOSURE_VERSION` est inchangé.

### Ce que le passage en 0.9.0 change pour la revue

- **Aucune permission ne change.** Ni obligatoire, ni facultative, ni motif
  d'hôte : le manifest est identique à la 0.8.0 sur tout ce qui se déclare.
- **Aucune donnée nouvelle, aucun hôte nouveau, aucun code distant.** La seule
  nouveauté est une surface d'AFFICHAGE : la bibliothèque de prompts que
  l'extension récupérait déjà (canal facultatif de la 0.8.0, inchangé) devient
  consultable dans la popup. Lecture seule, rendu en `textContent`, copie
  locale dans le presse-papiers au clic — rien ne quitte l'appareil, le
  presse-papiers est local.
- La divulgation de l'usage des données est inchangée, `DISCLOSURE_VERSION`
  aussi : rien de nouveau n'est capturé ni transmis.

### Ce que le passage en 0.8.0 change pour la revue

- **Une permission facultative ajoutée, aucune permission obligatoire.**
  `optional_host_permissions: ["https://*/*"]` apparaît au manifest. Elle n'est
  **jamais** accordée à l'installation : Chrome ne l'affiche pas dans l'écran
  d'installation, et l'extension ne demande jamais `https://*/*` en bloc. Le
  seul appel à `chrome.permissions.request` (dans `popup/popup.js`) passe
  l'origine **exacte** publiée par l'établissement de l'utilisateur, et il
  n'est atteignable qu'en cliquant « Activer la bibliothèque » sur une carte
  qui ne s'affiche que si cet établissement a configuré une adresse. Le motif
  du caractère facultatif est structurel : l'adresse varie d'un établissement à
  l'autre, elle ne peut pas être déclarée à l'avance.
- **Aucune donnée ne part vers cet hôte.** `fetch(url, { credentials: "omit" })`
  dans `src/background.js`, sans en-tête d'authentification et sans paramètre
  dérivé du compte. C'est une lecture, jamais un envoi. Bornes appliquées à la
  réponse : 256 Ko, 200 entrées, champs inconnus ignorés, délai de 4 s,
  cache de 6 h. Le JSON récupéré est affiché comme du **texte** (`textContent`),
  jamais évalué : aucun code distant n'est exécuté.
- **Aucune nouvelle catégorie de données collectée.** La divulgation ci-dessus
  est inchangée ; la politique de confidentialité gagne une section 6 bis qui
  décrit cette lecture et son caractère facultatif.
- **Correction d'un défaut de parité entre langues** dans le barème local
  (v3) : sans effet sur les permissions ni sur les données transmises.

### Ce que le passage en 0.7.0 change pour la revue

- **Aucune permission ajoutée** : le manifest reste à `storage` + `alarms`.
  L'appairage utilise `chrome.tabs.create`, qui ne requiert pas la permission
  `tabs`, et `chrome.action.setBadgeText`, déjà couvert par la clé `action`.
- **Pas de `externally_connectable`, pas de `web_accessible_resources`** : rien
  ne rend l'extension détectable ou adressable par une page tierce.
  **Nuancé en 1.0.2, pas contredit : ça reste vrai pour toute page tierce**,
  y compris les cinq sites d'IA. Ce qui change, c'est que l'extension se
  déclare désormais sur une origine qui est la NÔTRE, `companion.mines.paris`
  (`src/presence.js`, permission d'hôte obligatoire) — l'app du programme, pas
  un tiers. Aucune autre page ne peut la détecter par ce canal ; voir la
  section 1.0.2 plus bas.
- **Mesures post-réponse : nouvelles données transmises.** La divulgation et la
  politique de confidentialité ont été mises à jour dans le même commit
  (ligne « Activité de l'utilisateur » du tableau ci-dessus, points 2 et 4 de la
  politique). L'objectif unique a été reformulé pour couvrir le moment
  post-réponse. Aucune permission ni aucun hôte nouveau : les mesures se font
  dans les content scripts déjà déclarés, par lecture du DOM.
- **Pas d'interception réseau.** Aucun patch de `fetch` ou `XMLHttpRequest`,
  aucun script en monde MAIN, aucune `webRequest`. Le nom du modèle et la
  taille de la réponse viennent du DOM, comme le reste.
- **Avis de mise à jour, non bloquant** : les comptes ayant accepté la
  divulgation en version 1 voient un bandeau d'information au prochain
  ouverture du popup, sans repasser l'extension en veille. Même finalité,
  mêmes catégories de données ; couper des classes en cours d'année serait
  disproportionné.
- ✅ **Tranché le 25/08/2026 : « authentification » passe à Oui — et
  repasse à Non en 1.0.0, formulaire retiré (voir plus haut).** Le tableau
  ci-dessus déclarait « Non » alors que `store/description-fr.md` cochait
  « Oui » — deux fichiers, deux déclarations opposées, dont une fausse. Le
  formulaire de repli existe toujours (`popup/popup.html`, `#auth-password`) et
  `CoachApi.login()` appelle `token?grant_type=password` : un mot de passe est
  bien transmis. C'est donc « Oui », et les deux fichiers le disent maintenant.
  L'autre sortie reste ouverte pour une version future : retirer le formulaire
  de repli et ne garder que l'appairage par le web, ce qui rendrait « Non »
  incontestable — au prix d'un relecteur obligé de passer par le web pour
  tester la fonction classe. Ne jamais revenir à « Non » tant que le formulaire
  est dans le paquet : une divulgation inexacte est un motif de RETRAIT après
  publication, pas seulement de rejet.

## Marques citées

« ChatGPT », « Claude », « Gemini », « Mistral », « Grok » apparaissent en usage
nominatif (désigner les sites compatibles). Contraintes tenues :
le nom de l'extension ne contient aucune marque tierce, aucun logo tiers n'est
utilisé, et la fiche ne suggère jamais une affiliation ou un partenariat.
