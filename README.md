# I-BE³ Companion (extension)

**Le garde-fou de ton prompting.** Comme les applications qui t'aident à décrocher de ton téléphone, I-BE³ Companion ajoute une pause réfléchie avant tes prompts IA : les demandes trop vagues sont retenues *avant* d'atteindre l'IA, et un dialogue socratique t'aide à penser par toi-même : puis c'est toujours toi qui décides d'envoyer.

*The guardrail for your prompting: a thoughtful pause before your AI prompts, on ChatGPT, Claude, Gemini, Mistral and Grok. 100% local by default. English description in [store/description-en.md](store/description-en.md).*

**État (16 septembre 2026)** : version **1.0.3** — la bibliothèque de prompts
s'ouvre **dans la page** : `//` tapé dans un composeur vide, `Ctrl+Shift+.`
(`⌘⇧.` sur Mac, réglable dans `chrome://extensions/shortcuts`) ou le bouton
« Prompts » de la pastille ouvrent une palette (`src/picker.js`) groupée
Favoris / Récents / Programme / Promotion ; Entrée **insère** le gabarit dans
le composeur sans rien envoyer (un brouillon en cours est gardé, le gabarit
vient après une ligne vide), Maj+Entrée copie, Échap ferme. Le popup gagne
« Insérer » vers l'onglet de chat actif. Les favoris viennent de la base
(`prompt_favorites`, session appairée), les récents restent locaux
(`libraryRecent`, écrit par le seul worker), et chaque reprise appelle
`count_prompt_copy` quand l'id est un uuid. La 1.0.2 avait appris à l'app si
l'extension est installée et si elle remonte encore, sans attendre le premier
prompt synchronisé : un battement de présence upserte l'état d'installation
dans `extension_devices` côté serveur, et `src/presence.js` l'annonce dans le
DOM de `companion.mines.paris` côté navigateur — la seule origine où
l'extension se signale. La permission d'hôte sur `companion.mines.paris`
devient donc **obligatoire** (`host_permissions`, divulgation version 3) : à la
mise à jour, Chrome **désactive l'extension** jusqu'à ce que l'étudiant
réaccorde la permission, et tant qu'il ne l'a pas fait rien ne tourne — la page
`/companion` la dit alors non installée ; le popup ouvre `/companion` par
défaut, avec un second bouton vers `/prompts`. La 1.0.1 avait déjà fait passer
l'interface en anglais (comme l'app), retiré le profil d'usage de l'onboarding
et visé l'adresse de l'app, `companion.mines.paris` (domaine du programme
depuis le 16/09) à la place de l'alias `ibe3.vercel.app` ; servie par l'app
(`https://companion.mines.paris/extension`) ; fiche Chrome Web Store à jour
(`store/SUBMISSION.md`). Avant la 1.0.0, l'extension s'appelait Prompt Tracker
et avait son propre backend et son propre site (`track-prompt.vercel.app`) :
les deux sont retirés, le nom du dépôt et des zips reste (identifiants).

## Pour qui ?
- **Les étudiants du programme I-BE³** : apprendre avec l'IA sans qu'elle pense à leur place. Depuis la 1.0.1, l'onboarding ne demande plus de profil d'usage (étudiant / consultant / salarié) : le vocabulaire des questions est celui du devoir.

## Comment ça marche
1. Tu écris ton prompt sur **ChatGPT, Claude, Gemini, Mistral ou Grok**, comme d'habitude.
2. Chaque prompt est **scoré localement** (clarté, contexte, itération, esprit critique) dans **la langue où il est écrit**, FR ou EN. Sous le seuil, l'envoi est **retenu** : aucun crédit consommé et le miroir socratique s'ouvre : une question à la fois (ton hypothèse ? ce que tu sais déjà ? comment tu vérifieras ?). Le dialogue **rend la main** quand chaque axe faible a reçu une réponse ; tu peux en demander une de plus, et c'est toujours toi qui décides d'envoyer.
3. Tu envoies **ta version enrichie de ta réflexion**, ou ta demande initiale telle quelle. Toujours ton choix.

## Architecture
| Brique | Rôle |
|---|---|
| [`extension/`](extension) | Extension Chrome MV3 « I-BE³ Companion » : scoring local, interception, dialogue socratique, badge, thèmes light/dark, FR/EN. Fonctionne 100 % en local sans compte. |
| App I-BE³ Companion (dépôt `ibe3-companion`, `companion.mines.paris`) | Le compte, l'appairage de l'extension (`/extension/pair`), le journal des dialogues (`/prompts`), les réglages de partage (`/settings`), la méthode (`/help#method`) et la notice de confidentialité (`/extension/privacy`). Sert aussi le zip de l'extension. |
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
# et http://localhost:4321/tests/picker-harness.html (sélecteur de prompts, 1.0.3)
#   ?dark=1 ?empty=1 ?notready=1 ; « // » dans le composeur factice, ou __open()
#   globales : __open(source) __composer() -> texte du composeur, __close()
```

### Viser une autre stack (dev local)
L'extension embarque les valeurs de **production** : Supabase hébergé
`kbbrkrvacazkxraudvng` (clé *publishable*, publique par conception) et
`https://companion.mines.paris`. Pour travailler contre la stack locale de l'app
(`pnpm dev` dans `ibe3-companion`, qui lance aussi `supabase start`), modifier
**les trois constantes de [`extension/src/config.js`](extension/src/config.js)** (le seul fichier de configuration ; `supabase.js` les y lit) :

| Constante | Production (embarquée) | Dev local |
|---|---|---|
| `SUPABASE_URL` | `https://kbbrkrvacazkxraudvng.supabase.co` | `http://127.0.0.1:54421` |
| `SUPABASE_KEY` | `sb_publishable_…` du projet | la clé *anon* affichée par `supabase start` |
| `APP_URL` | `https://companion.mines.paris` | `http://localhost:3200` |

Toutes les URL de l'extension (appairage, « Ouvrir l'app », méthode, notice de
confidentialité, lien « ? » de la modale) dérivent de `CoachConfig.APP_URL` :
rien d'autre à toucher. `config.js` est chargé partout, y compris dans les
content scripts des sites IA (qui n'ont besoin que d'`APP_URL`) ; le client
REST/Auth (`supabase.js`) ne l'est que dans le worker, le popup et la page de
consentement. Ne jamais commiter ni empaqueter les valeurs locales — `package.sh`
s'y refuse. Recharger l'extension dans `chrome://extensions` après modification.

Pour que `src/presence.js` s'annonce aussi sur l'app locale, ajouter à la main
`http://localhost:3200/*` à **deux** endroits dans `extension/manifest.json` :
`host_permissions` et les `matches` du content script de présence (celui qui
charge `src/presence.js`). `scripts/package.sh` refuse d'empaqueter tant que
l'un des deux motifs — ou tout autre `host_permissions`,
`optional_host_permissions` ou `content_scripts[].matches` — commence par
`http://` : retirer les deux avant de livrer.

Ajouter un site IA = un fichier `extension/src/adapters/<site>.js` (sélecteurs du composeur et du bouton d'envoi) + une entrée `content_scripts` dans le manifest : toute la mécanique est partagée par [`factory.js`](extension/src/adapters/factory.js).

## Livrer une version
1. Bumper `version` dans `extension/manifest.json`, mettre à jour `store/SUBMISSION.md` (entrée de version, notes au relecteur) et, si l'UI a changé, les captures.
2. Tests + harnais (ci-dessus), `./scripts/webstore-check.sh`.
3. Commit sur `main`, tag `v<version>`, push du tag.
4. Zip depuis un worktree propre du tag ; copie dans `public/` de l'app (`IBE3_PUBLIC_DIR=…`), bump de `lib/extension-release.ts` là-bas, push de `main` de l'app (déploiement automatique).
5. Soumission Chrome Web Store (compte du propriétaire) ; Edge/Firefox seulement si une demande existe (`docs/PORTS.md`).

Le contrat que l'extension attend de la base (les quinze appels PostgREST/GoTrue, dont, depuis la 1.0.3, la lecture de `prompt_favorites` et la RPC `count_prompt_copy`) est épinglé côté app par `tests/consent/tracker.test.ts` : une migration qui le casse fait échouer la suite de l'app avant d'atteindre la production. L'extension se dégrade sans bruit tant que la migration n'est pas passée : favoris à `null` (404 avalé), RPC ignorée.

## Design
« Éditorial calme » : light par défaut + thème dark (et système), crème/encre, accent white-label (sauge par défaut), Fraunces + IBM Plex Sans. Le badge « ● I-BE³ Companion » dans l'UI du chat signale que l'extension est active.
