# I-BE³ Companion (extension)

**Le garde-fou de ton prompting.** Comme les applications qui t'aident à décrocher de ton téléphone, I-BE³ Companion ajoute une pause réfléchie avant tes prompts IA : les demandes trop vagues sont retenues *avant* d'atteindre l'IA, et un dialogue socratique t'aide à penser par toi-même : puis c'est toujours toi qui décides d'envoyer.

*The guardrail for your prompting: a thoughtful pause before your AI prompts, on ChatGPT, Claude, Gemini, Mistral and Grok. 100% local by default. English description in [store/description-en.md](store/description-en.md).*

**État (15 septembre 2026)** : version **1.0.0**, tag `v1.0.0`, première
version construite pour la base fusionnée d'I-BE³ ; servie par l'app
(`https://ibe3.vercel.app/extension`) ; fiche Chrome Web Store en préparation
(`store/SUBMISSION.md`). Avant la 1.0.0, l'extension s'appelait Prompt Tracker
et avait son propre backend et son propre site (`track-prompt.vercel.app`) :
les deux sont retirés, le nom du dépôt et des zips reste (identifiants).

## Pour qui ?
- **Étudiants** : apprendre avec l'IA sans qu'elle pense à leur place
- **Consultants** : des prompts qui portent leur raisonnement
- **Entreprises & organismes de formation** : bonnes pratiques, esprit critique, alternative au shadow IT, en marque blanche

## Comment ça marche
1. Tu écris ton prompt sur **ChatGPT, Claude, Gemini, Mistral ou Grok**, comme d'habitude.
2. Chaque prompt est **scoré localement** (clarté, contexte, itération, esprit critique) dans **la langue où il est écrit**, FR ou EN. Sous le seuil, l'envoi est **retenu** : aucun crédit consommé et le miroir socratique s'ouvre : une question à la fois (ton hypothèse ? ce que tu sais déjà ? comment tu vérifieras ?). Le dialogue **rend la main** quand chaque axe faible a reçu une réponse ; tu peux en demander une de plus, et c'est toujours toi qui décides d'envoyer.
3. Tu envoies **ta version enrichie de ta réflexion**, ou ta demande initiale telle quelle. Toujours ton choix.

## Architecture
| Brique | Rôle |
|---|---|
| [`extension/`](extension) | Extension Chrome MV3 « I-BE³ Companion » : scoring local, interception, dialogue socratique, badge, thèmes light/dark, FR/EN. Fonctionne 100 % en local sans compte. |
| App I-BE³ Companion (dépôt `ibe3-companion`, `ibe3.vercel.app`) | Le compte, l'appairage de l'extension (`/extension/pair`), le journal des dialogues (`/prompts`), les réglages de partage (`/settings`), la méthode (`/help#method`) et la notice de confidentialité (`/extension/privacy`). Sert aussi le zip de l'extension. |
| Supabase hébergé (Paris, eu-west-3) | Auth, Postgres + RLS : la base de l'app, dans laquelle l'extension écrit directement depuis la 1.0.0. |
| [`dashboard/`](dashboard) | Ancien dashboard Next.js (`track-prompt.vercel.app`). **Plus déployé ni maintenu** : gardé pour mémoire, son journal des dialogues a été porté dans l'app ; son seul rôle restant est de rediriger l'ancien domaine (voir `dashboard/README.md`). Son API d'organisation ([docs/API.md](docs/API.md)) et le contrat d'intégration ([docs/INTEGRATION.md](docs/INTEGRATION.md)) sont retirés avec lui. |
| [`store/`](store) | Fiche Chrome Web Store (FR/EN), justification des permissions, notes au relecteur. |

En mode organisation, seuls des **indicateurs** sont synchronisés (catégorie, scores, compteurs) : jamais le texte des prompts, sauf opt-in explicite de l'organisation, et un trigger Postgres l'efface sinon.

## Développement
```bash
# Extension : chrome://extensions → Mode développeur → « Charger l'extension non empaquetée » → extension/

# Packager pour les stores (Chrome + Edge + Firefox, voir docs/PORTS.md).
# À lancer depuis un worktree PROPRE de la révision de release (le tag) :
git worktree add /tmp/pt-release v1.0.0
(cd /tmp/pt-release && ./scripts/package.sh)   # → dist/prompt-tracker[-edge|-firefox]-<version>.zip
# IBE3_PUBLIC_DIR=/chemin/vers/ibe3-companion/public ./scripts/package.sh
#   dépose directement le zip Chrome dans public/ de l'app (sinon le chemin
#   est imprimé). Le script refuse d'empaqueter si src/config.js ne vise
#   pas une stack https.
./scripts/webstore-check.sh                  # pré-vol Chrome Web Store (curl la politique de confidentialité)

# Tests (aucune CI dans ce dépôt : ils se lancent à la main)
for f in extension/tests/*.test.js; do node "$f"; done
node extension/tests/scoring-eval.js         # banc du barème + parité FR/EN

# Harnais visuels de l'extension (modale, popup, badge, consentement) :
python3 -m http.server 4321 --directory extension
# puis http://localhost:4321/tests/modal-harness.html
#   ?library=1 ?noscore=1 ?llm=1 ?exhaust=1 (cumulables)
#   globales : __answer("…") __reroll() __edit() __done() __recompile() __lib(i)
#              __check() -> [] si la vue construite et le texte envoyé s'accordent
```

### Viser une autre stack (dev local)
L'extension embarque les valeurs de **production** : Supabase hébergé
`kbbrkrvacazkxraudvng` (clé *publishable*, publique par conception) et
`https://ibe3.vercel.app`. Pour travailler contre la stack locale de l'app
(`pnpm dev` dans `ibe3-companion`, qui lance aussi `supabase start`), modifier
**les trois constantes de [`extension/src/config.js`](extension/src/config.js)** (le seul fichier de configuration ; `supabase.js` les y lit) :

| Constante | Production (embarquée) | Dev local |
|---|---|---|
| `SUPABASE_URL` | `https://kbbrkrvacazkxraudvng.supabase.co` | `http://127.0.0.1:54421` |
| `SUPABASE_KEY` | `sb_publishable_…` du projet | la clé *anon* affichée par `supabase start` |
| `APP_URL` | `https://ibe3.vercel.app` | `http://localhost:3200` |

Toutes les URL de l'extension (appairage, « Ouvrir l'app », méthode, notice de
confidentialité, lien « ? » de la modale) dérivent de `CoachConfig.APP_URL` :
rien d'autre à toucher. `config.js` est chargé partout, y compris dans les
content scripts des sites IA (qui n'ont besoin que d'`APP_URL`) ; le client
REST/Auth (`supabase.js`) ne l'est que dans le worker, le popup et la page de
consentement. Ne jamais commiter ni empaqueter les valeurs locales — `package.sh`
s'y refuse. Recharger l'extension dans `chrome://extensions` après modification.

Ajouter un site IA = un fichier `extension/src/adapters/<site>.js` (sélecteurs du composeur et du bouton d'envoi) + une entrée `content_scripts` dans le manifest : toute la mécanique est partagée par [`factory.js`](extension/src/adapters/factory.js).

## Livrer une version
1. Bumper `version` dans `extension/manifest.json`, mettre à jour `store/SUBMISSION.md` (entrée de version, notes au relecteur) et, si l'UI a changé, les captures.
2. Tests + harnais (ci-dessus), `./scripts/webstore-check.sh`.
3. Commit sur `main`, tag `v<version>`, push du tag.
4. Zip depuis un worktree propre du tag ; copie dans `public/` de l'app (`IBE3_PUBLIC_DIR=…`), bump de `lib/extension-release.ts` là-bas, push de `main` de l'app (déploiement automatique).
5. Soumission Chrome Web Store (compte du propriétaire) ; Edge/Firefox seulement si une demande existe (`docs/PORTS.md`).

Le contrat que l'extension attend de la base (les douze appels PostgREST/GoTrue) est épinglé côté app par `tests/consent/tracker.test.ts` : une migration qui le casse fait échouer la suite de l'app avant d'atteindre la production.

## Design
« Éditorial calme » : light par défaut + thème dark (et système), crème/encre, accent white-label (sauge par défaut), Fraunces + IBM Plex Sans. Le badge « ● I-BE³ Companion » dans l'UI du chat signale que l'extension est active.
