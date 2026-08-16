#!/usr/bin/env bash
# Déploie le dashboard en production, puis vérifie l'URL publique.
#
# LE CHEMIN DE DÉPLOIEMENT EST GIT. Un push sur `main` déclenche le projet
# Vercel `prompt-tracker`, qui possède track-prompt.vercel.app : le domaine
# suit tout seul le dernier déploiement de production. Ce script ne fait que
# pousser et attendre.
#
# Historique, pour ne pas refaire l'erreur : ce script posait auparavant un
# alias à la main après un `vercel deploy --prod` du projet `track-prompt`.
# C'était un contournement d'un tout autre problème — `prompt-tracker` avait
# son Root Directory vide, donc il construisait à la racine du dépôt où il n'y
# a pas de package.json, et TOUS ses builds échouaient en 2 s. L'alias manuel
# masquait cette panne. Root Directory est maintenant réglé sur `dashboard` et
# le pipeline Git fonctionne ; réaliaser à la main volerait désormais le
# domaine au déploiement Git, ce qui rendrait les pushs sans effet visible.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] || { echo "✗ branche courante : $BRANCH — le déploiement part de main"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "✗ des modifications ne sont pas commitées"; exit 1; }

echo "→ push sur main (déclenche le déploiement)"
git push origin main

echo "→ attente du déploiement de production"
DEPLOYED=""
for _ in $(seq 1 60); do
  # `vercel inspect` sur le domaine public renvoie le déploiement qu'il sert.
  STATE="$(vercel inspect track-prompt.vercel.app 2>&1 | awk '/^ *status/{print $2}')"
  SHA="$(curl -fsS https://track-prompt.vercel.app/ -o /dev/null -w '%{http_code}' || echo 000)"
  if [ "$STATE" = "●" ] && [ "$SHA" = "200" ]; then DEPLOYED="oui"; break; fi
  sleep 5
done
[ -n "$DEPLOYED" ] || echo "⚠ délai dépassé — vérifier sur vercel.com (le build peut encore tourner)"

echo "→ vérification"
curl -sS -o /dev/null -w "https://track-prompt.vercel.app → HTTP %{http_code}\n" -L "https://track-prompt.vercel.app/"
curl -sS -o /dev/null -w "/api/v1/groups (clé invalide) → HTTP %{http_code} (attendu 401)\n" \
  "https://track-prompt.vercel.app/api/v1/groups" -H "Authorization: Bearer pt_live_invalid"
curl -sS -o /dev/null -w "/embed (sans jeton) → HTTP %{http_code} (attendu 400)\n" \
  "https://track-prompt.vercel.app/embed/class-progress"
