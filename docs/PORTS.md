# Portages navigateurs : Edge, Firefox, Safari

Un seul code source (`extension/`), trois paquets. `./scripts/package.sh` produit
les trois d'un coup dans `dist/` :

| Paquet | Cible | Différence avec Chrome |
|---|---|---|
| `prompt-tracker-<v>.zip` | Chrome Web Store | référence |
| `prompt-tracker-edge-<v>.zip` | Edge Add-ons (Partner Center) | aucune : même zip, nom explicite |
| `prompt-tracker-firefox-<v>.zip` | Firefox AMO | manifest transformé (voir ci-dessous) |

## Edge (Chromium)

Rien à changer : soumettre `prompt-tracker-edge-<v>.zip` au
[Partner Center](https://partner.microsoft.com/dashboard/microsoftedge) (compte
Microsoft requis, review en quelques jours). Réutiliser la fiche de
`store/description-{fr,en}.md` ; les justifications de permissions s'appliquent
telles quelles.

## Firefox (Gecko)

Le zip Firefox est généré avec deux transformations de manifest (le reste du
code est strictement partagé) :

1. **Event page au lieu du service worker** : `background.scripts =
   ["src/supabase.js", "src/background.js"]`. Côté code, `background.js` garde
   `importScripts` sous garde (`typeof importScripts === "function"`) : Chrome
   et Safari chargent `supabase.js` par `importScripts`, Firefox par la liste
   `scripts`.
2. **`browser_specific_settings.gecko`** : id `prompt-tracker@track-prompt.vercel.app`,
   `strict_min_version` 121.0.

**Permissions d'hôte** : Firefox ne les accorde pas à l'installation (MV3 les
traite comme optionnelles). L'onboarding les demande dans le geste de clic
« J'accepte et j'active » (`chrome.permissions.request` sur les `matches` des
content scripts). Sous Chrome, l'appel est silencieux (déjà accordées). Un refus
partiel est respecté : l'extension ne tourne que sur les sites accordés.

Soumission : [addons.mozilla.org](https://addons.mozilla.org/developers/)
(compte AMO requis, publication généralement sous 24 h). Avant soumission,
valider avec `npx web-ext lint --source-dir <zip décompressé>`.

## Safari (macOS + iOS)

Le projet Xcode généré par `safari-web-extension-converter` vit dans
`safari/Prompt Tracker/` (app conteneur + extension, cibles macOS et iOS,
ressources copiées depuis `extension/` — re-générer ou re-copier après chaque
évolution de l'extension) :

```bash
# Regénérer les ressources après une modif de extension/ :
xcrun safari-web-extension-converter extension --project-location safari \
  --app-name "Prompt Tracker" --bundle-identifier app.track-prompt.PromptTracker \
  --no-open --no-prompt --copy-resources --force
# puis nettoyer safari/Prompt Tracker/Shared (Extension)/Resources :
# supprimer tests/, prompt-tracker-logo/ et les zips éventuels.
```

Build local sans signature : ouvrir le projet dans Xcode, cible
« Prompt Tracker (macOS) », puis autoriser l'extension non signée dans
Safari → Réglages → Développeur. La distribution (App Store ou notarisation)
exige un compte Apple Developer (99 $/an) : étape à déclencher sur signal de
demande, conformément au pre-mortem du roadmap.

## Ce qui reste manuel (comptes du propriétaire)

Les trois soumissions store (Partner Center, AMO, App Store Connect) demandent
les comptes développeur du propriétaire : aucun envoi n'est automatisé ici.
