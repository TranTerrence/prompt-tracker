# dashboard/ — l'ancien site de Prompt Tracker (retiré)

Ce dossier est le dashboard Next.js qui servait `track-prompt.vercel.app` :
tableau de bord, journal des dialogues, page « Méthode », notice de
confidentialité, API d'organisation, migrations du backend Prompt Tracker
(`supabase/migrations/`).

**Il n'est plus déployé ni maintenu depuis le 15 septembre 2026.** Avec la
fusion des deux bases, tout ce qu'il montrait vit dans l'app I-BE³ Companion
(`ibe3.vercel.app`) :

| Ici (avant) | Là-bas (maintenant) |
|---|---|
| Journal des dialogues | `/prompts` (chaque entrée se déplie) |
| Page « Méthode » | `/help#method` |
| Notice de confidentialité | `/extension/privacy` |
| Appairage de l'extension | `/extension/pair` |
| Réglages de partage | `/settings` → My data |
| Administration d'organisation | `/admin/tracker` |
| API d'organisation, widgets | retirés (`docs/API.md`) |
| `supabase/migrations/` | portées dans `ibe3-companion/supabase/migrations/20260916*` (copies dans `ibe3-companion/docs/tracker-origin/`) |

Le code est gardé pour mémoire (l'historique git le conserve de toute façon).
Ne pas le relancer contre la base d'I-BE³ : son schéma est celui de l'ancien
backend.

## Ce qu'il reste à faire de ce dossier

**Rediriger l'ancien domaine**, puis l'éteindre. Le `vercel.json` de ce
dossier renvoie toute URL de `track-prompt.vercel.app` vers
`https://ibe3.vercel.app/extension` (307). À déployer sur le projet Vercel
`prompt-tracker` **après la recette réelle** de l'app (lot D du plan de
bascule) :

```bash
cd dashboard && vercel deploy --prod
curl -I https://track-prompt.vercel.app/     # → 307 vers ibe3.vercel.app/extension
```

Trente jours plus tard : supprimer le projet Vercel `prompt-tracker` et le
projet Supabase `ovbvwawzrciwpudnaysp` (167 événements de test, rien à
garder). Le dossier peut alors disparaître du dépôt.
