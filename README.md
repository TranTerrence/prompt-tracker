# Prompt Tracker

**Le garde-fou de ton prompting.** Comme les applications qui t'aident à décrocher de ton téléphone, Prompt Tracker ajoute une pause réfléchie avant tes prompts IA : les demandes trop vagues sont retenues *avant* d'atteindre l'IA, et un dialogue socratique t'aide à penser par toi-même : puis c'est toujours toi qui décides d'envoyer.

*The guardrail for your prompting: a thoughtful pause before your AI prompts, on ChatGPT, Claude and Gemini. 100% local by default. English description in [store/description-en.md](store/description-en.md).*

## Pour qui ?
- **Étudiants** : apprendre avec l'IA sans qu'elle pense à leur place
- **Consultants** : des prompts qui portent leur raisonnement
- **Entreprises & organismes de formation** : bonnes pratiques, esprit critique, alternative au shadow IT, en marque blanche

## Comment ça marche
1. Tu écris ton prompt sur **ChatGPT, Claude ou Gemini**, comme d'habitude.
2. Chaque prompt est **scoré localement** (clarté, contexte, itération, esprit critique). Sous le seuil, l'envoi est **retenu** : aucun crédit consommé et le miroir socratique s'ouvre : une question à la fois (ton hypothèse ? ce que tu sais déjà ? comment tu vérifieras ?), aussi longtemps que tu veux.
3. Tu envoies **ta version enrichie de ta réflexion**, ou ta demande initiale telle quelle. Toujours ton choix.

## Architecture
| Brique | Rôle |
|---|---|
| [`extension/`](extension) | Extension Chrome MV3 : scoring local, interception, dialogue socratique, badge, thèmes light/dark, FR/EN. Fonctionne 100 % en local sans compte. |
| [`dashboard/`](dashboard) | Next.js : espace organisation white-label (marque, seuil, questions, gestion utilisateurs, KPIs, export) + progression personnelle + `/privacy`. |
| Supabase (UE, Paris) | Auth optionnelle, Postgres + RLS multi-tenant, Edge Function `socratic-llm` (questions sur mesure, optionnel). |
| [`store/`](store) | Fiche Chrome Web Store (FR/EN) et justification des permissions. |

En mode organisation, seuls des **indicateurs** sont synchronisés (catégorie, scores, compteurs) : jamais le texte des prompts, sauf opt-in explicite de l'organisation, et un trigger Postgres l'efface sinon.

## Développement
```bash
# Extension : chrome://extensions → Mode développeur → « Charger l'extension non empaquetée » → extension/
# Dashboard :
cd dashboard && cp .env.example .env.local  # renseigner les clés Supabase
npm install && npm run dev                   # http://localhost:3000

# Packager pour le Chrome Web Store :
./scripts/package.sh                         # → dist/prompt-tracker-<version>.zip
```

Ajouter un site IA = un fichier `extension/src/adapters/<site>.js` (sélecteurs du composeur et du bouton d'envoi) + une entrée `content_scripts` dans le manifest : toute la mécanique est partagée par [`factory.js`](extension/src/adapters/factory.js).

## Design
« Éditorial calme » : light par défaut + thème dark (et système), crème/encre, accent white-label (sauge par défaut), Fraunces + IBM Plex Sans. Le badge « ● Prompt Tracker » dans l'UI du chat signale que l'extension est active.
