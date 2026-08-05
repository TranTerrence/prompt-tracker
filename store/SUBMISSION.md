# Réponses de soumission — Chrome Web Store

Les champs du Developer Dashboard, écrits une fois et recopiés **verbatim** à
chaque envoi. Les réécrire à chaque fois est le principal moyen de se contredire
d'une version à l'autre — une incohérence entre deux soumissions est un motif de
rejet, et pire, de retrait après publication.

Toute modification du code qui change une réponse ci-dessous doit modifier ce
fichier **dans le même commit**.

---

## Objectif unique (single purpose)

> Prompt Tracker ajoute une étape de réflexion avant l'envoi d'un prompt sur les
> interfaces de chat IA, et restitue à l'utilisateur la qualité de ses prompts.

Une seule phrase, un seul verbe. Toute fonctionnalité qui ne se rattache pas à
cette phrase doit être retirée ou la phrase réécrite — le Store rejette les
extensions « couteau suisse ».

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
> prompt ne parte. Chaque domaine est listé explicitement ; aucune permission
> large (`<all_urls>`, `*://*/*`) n'est demandée.

**Remote code : NON.** Tout le JavaScript est dans le paquet. `supabase.js` est
un client HTTP écrit à la main (`fetch`), pas un SDK chargé depuis un CDN.
L'appel à Anthropic transmet des *données* et reçoit du *texte* — jamais de code
exécutable.

## Divulgation de l'usage des données

Cocher exactement ceci — et rien de plus :

| Catégorie | Collectée ? | Pourquoi |
|---|---|---|
| Informations personnelles identifiables | **Oui** — email | Identifie l'élève auprès de son enseignant, uniquement après avoir rejoint une classe |
| Activité de l'utilisateur | **Oui** | Scores, catégorie, nombre de mots, issue — le cœur du tableau de bord |
| Contenu du site web | **Oui** | Le texte du prompt, **seulement** si l'utilisateur active l'option et consent catégorie par catégorie |
| Santé, financier, authentification, localisation, communications personnelles | **Non** | — |

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
> Aucun compte n'est nécessaire pour l'usage individuel. La fonction « classe »
> est optionnelle ; compte de test si besoin : <À FOURNIR AVANT ENVOI>.

⚠️ Remplacer `<À FOURNIR AVANT ENVOI>` par un vrai compte de démonstration, ou
supprimer la phrase. Un relecteur bloqué sur un login rejette sans appel.

## Marques citées

« ChatGPT », « Claude », « Gemini », « Mistral », « Grok » apparaissent en usage
nominatif (désigner les sites compatibles). Contraintes tenues :
le nom de l'extension ne contient aucune marque tierce, aucun logo tiers n'est
utilisé, et la fiche ne suggère jamais une affiliation ou un partenariat.
