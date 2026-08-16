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
> les interfaces de chat IA, en le faisant réfléchir avant l'envoi et en lui
> restituant l'effet obtenu.

Une seule phrase, un seul verbe. Toute fonctionnalité qui ne se rattache pas à
cette phrase doit être retirée ou la phrase réécrite — le Store rejette les
extensions « couteau suisse ».

> **Réécrite en 0.7.0.** La formulation précédente était bornée à « avant
> l'envoi ». Les mesures post-réponse (longueur, durée, modèle, délai de
> lecture) débordaient donc l'objectif déclaré. Elles servent pourtant la même
> finalité — montrer à l'utilisateur ce que ses prompts produisent — d'où la
> reformulation autour de « améliorer la qualité de ses prompts », qui couvre
> les deux moments sans devenir une liste de fonctionnalités.

## Justification des permissions

Recopier ces textes dans le champ « justification » de chaque permission.

| Permission | Justification à coller |
|---|---|
| `storage` | Stocke localement les réglages de l'utilisateur (seuil, thème, consentements) et l'historique de ses scores de prompts, qui alimente le tableau de bord de progression affiché dans la popup. Aucune de ces données ne quitte l'appareil sans consentement explicite. |
| `alarms` | Planifie la synchronisation périodique en arrière-plan pour les utilisateurs ayant rejoint une classe. Sans elle, les indicateurs consentis ne remonteraient qu'à l'ouverture de la popup. |

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
| Santé, financier, authentification, localisation, communications personnelles | **Non** | — |

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

⚠️ Remplacer `<À FOURNIR AVANT ENVOI>` par un vrai compte de démonstration, ou
supprimer la phrase. Un relecteur bloqué sur un login rejette sans appel.

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
- ⚠️ **À trancher avant l'envoi : la ligne « authentification : Non » du tableau
  de divulgation.** Le chemin principal ne saisit plus aucun identifiant dans
  l'extension (l'appairage se fait sur le web), mais le repli replié sous
  « Se connecter avec un mot de passe » en saisit toujours un et le transmet à
  Supabase. Google range mots de passe et identifiants dans « Authentication
  information ». Deux sorties cohérentes, au choix :
  1. cocher « Oui » pour cette catégorie, en justifiant par le repli ;
  2. retirer le formulaire de repli du popup et laisser l'appairage seul — la
     déclaration « Non » devient alors incontestable, au prix d'un relecteur
     qui doit passer par le web pour tester la fonction classe.
  Ne pas laisser « Non » avec le formulaire en place : une divulgation
  inexacte est un motif de retrait après publication, pas seulement de rejet.

## Marques citées

« ChatGPT », « Claude », « Gemini », « Mistral », « Grok » apparaissent en usage
nominatif (désigner les sites compatibles). Contraintes tenues :
le nom de l'extension ne contient aucune marque tierce, aucun logo tiers n'est
utilisé, et la fiche ne suggère jamais une affiliation ou un partenariat.
