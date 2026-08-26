# Réponses de soumission — Chrome Web Store

Les champs du Developer Dashboard, écrits une fois et recopiés **verbatim** à
chaque envoi. Les réécrire à chaque fois est le principal moyen de se contredire
d'une version à l'autre — une incohérence entre deux soumissions est un motif de
rejet, et pire, de retrait après publication.

Toute modification du code qui change une réponse ci-dessous doit modifier ce
fichier **dans le même commit**.

---

## Objectif unique (single purpose)

> Prompt Tracker aide l'utilisateur à améliorer la qualité de ses prompts sur
> les interfaces de chat IA : il le fait réfléchir avant l'envoi — au besoin en
> lui montrant des prompts éprouvés — et lui restitue l'effet obtenu.

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
| `alarms` | Planifie la synchronisation périodique en arrière-plan pour les utilisateurs ayant rejoint une classe. Sans elle, les indicateurs consentis ne remonteraient qu'à l'ouverture de la popup. |
| `optional_host_permissions` : `https://*/*` | **Facultative, jamais accordée à l'installation.** Un établissement scolaire peut publier une bibliothèque de prompts pédagogiques à sa propre adresse ; l'extension ne peut pas connaître cette adresse à l'avance, elle varie d'un établissement à l'autre. Elle n'est donc PAS déclarée dans `host_permissions` : elle est demandée à l'exécution, par `chrome.permissions.request`, sur la **seule origine** configurée par l'établissement de l'utilisateur, et uniquement après un clic explicite de celui-ci dans la popup. Tant que l'utilisateur n'accorde rien, aucune requête n'est émise. L'appel est une simple lecture `GET` en `credentials: "omit"`, sans en-tête d'authentification et sans aucun paramètre dérivé du compte : aucune donnée utilisateur ne part vers cet hôte. Refuser la permission ne dégrade aucune autre fonction. |

**Match patterns des content scripts** (`chatgpt.com`, `chat.openai.com`,
`claude.ai`, `gemini.google.com`, `chat.mistral.ai`, `grok.com`) :

> L'extension doit lire le champ de saisie et intercepter l'envoi sur ces cinq
> interfaces de chat IA pour proposer sa question de réflexion avant que le
> prompt ne parte. Elle observe ensuite la zone de réponse pour en mesurer la
> longueur et la durée d'affichage, et lire le nom du modèle : c'est ce qui
> permet de montrer à l'utilisateur l'effet de ses prompts. Le texte de la
> réponse est compté puis oublié — il n'est ni stocké ni transmis. Chaque
> domaine est listé explicitement ; aucune permission large (`<all_urls>`,
> `*://*/*`) n'est demandée.

**Remote code : NON.** Tout le JavaScript est dans le paquet. `supabase.js` est
un client HTTP écrit à la main (`fetch`), pas un SDK chargé depuis un CDN.
L'appel à Anthropic transmet des *données* et reçoit du *texte* — jamais de code
exécutable.

## Divulgation de l'usage des données

Cocher exactement ceci — et rien de plus :

| Catégorie | Collectée ? | Pourquoi |
|---|---|---|
| Informations personnelles identifiables | **Oui** — email | Identifie l'élève auprès de son enseignant, uniquement après avoir rejoint une classe |
| Activité de l'utilisateur | **Oui** | Scores, catégorie, nombre de mots, issue, plus les mesures de réponse (longueur, durée de génération, modèle utilisé, délai avant le prompt suivant) — le cœur du tableau de bord |
| Contenu du site web | **Oui** | Le texte du prompt, **seulement** si l'utilisateur active l'option et consent catégorie par catégorie |
| Informations d'authentification | **Oui** — mot de passe | Le popup conserve un formulaire e-mail / mot de passe, replié sous « Se connecter avec un mot de passe ». Il appelle `token?grant_type=password` et transmet donc un mot de passe. Google range cela dans « Authentication information ». |
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

**Politique de confidentialité :** https://track-prompt.vercel.app/privacy
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
> La fonction « classe » est optionnelle. Elle se lie désormais par le web :
> le bouton « Lier mon compte » du popup ouvre un onglet sur
> https://track-prompt.vercel.app où l'utilisateur, une fois connecté, autorise
> le navigateur. Aucun mot de passe n'est saisi dans l'extension par ce chemin.
> Un formulaire e-mail / mot de passe reste disponible dans le popup, replié
> sous « Se connecter avec un mot de passe », pour tester sans quitter
> l'extension. Compte de démonstration : <À FOURNIR AVANT ENVOI>.
>
> **À propos de la permission d'hôte facultative `https://*/*` (nouveauté 0.8.0).**
> Elle n'est **jamais accordée à l'installation** : vous pouvez le constater sur
> `chrome://extensions` → Détails → « Accès au site », qui reste vide après une
> installation neuve. L'extension ne demande jamais `https://*/*` : le seul
> appel à `chrome.permissions.request` se trouve dans `popup/popup.js`
> (fonction du bouton « Activer la bibliothèque ») et passe l'**origine exacte**
> publiée par l'établissement de l'utilisateur, jamais un motif large.
>
> Cette fonction est **invisible sans compte de classe**, et c'est voulu : la
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

⚠️ Remplacer `<À FOURNIR AVANT ENVOI>` par un vrai compte de démonstration, ou
supprimer la phrase. Un relecteur bloqué sur un login rejette sans appel.

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
- ✅ **Tranché le 25/08/2026 : « authentification » passe à Oui.** Le tableau
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
