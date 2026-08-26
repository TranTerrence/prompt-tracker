# Portages navigateurs : Edge et Firefox

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
   charge `supabase.js` par `importScripts`, Firefox par la liste
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

## Safari : retiré

Le portage Safari (projet Xcode `safari/`, script `sync-safari.sh`) a été
retiré le 26/08/2026 : c'était une copie complète des ressources à
resynchroniser à chaque livraison — elle avait déjà dérivé de sept fichiers en
silence — sans signal de demande (cf. le pre-mortem du roadmap, qui le
conditionnait précisément à ce signal). L'historique git conserve tout ;
`safari-web-extension-converter` sait le régénérer depuis `extension/` le jour
où la demande existe.

## Ce qui reste manuel (comptes du propriétaire)

Les deux soumissions store (Partner Center, AMO) demandent les comptes
développeur du propriétaire : aucun envoi n'est automatisé ici.
