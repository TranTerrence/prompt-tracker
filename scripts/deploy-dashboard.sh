#!/usr/bin/env bash
# Déploie le dashboard en production ET repointe l'alias public.
# Nécessaire : track-prompt.vercel.app n'est pas un domaine du projet (il
# appartient à un autre projet Vercel), c'est un ALIAS manuel qui ne suit pas
# les nouveaux déploiements tout seul.
set -euo pipefail
cd "$(dirname "$0")/../dashboard"

echo "→ déploiement production"
URL=$(vercel deploy --prod --yes 2>&1 | grep -oE 'https://track-prompt-[a-z0-9]+-terrence-fr\.vercel\.app' | head -1)
[ -n "$URL" ] || { echo "URL de déploiement introuvable"; exit 1; }
echo "→ $URL"

echo "→ alias public"
vercel alias set "$URL" track-prompt.vercel.app

echo "→ vérification"
sleep 8
curl -sS -o /dev/null -w "https://track-prompt.vercel.app → HTTP %{http_code}\n" -L "https://track-prompt.vercel.app/"
curl -sS -o /dev/null -w "/api/v1/groups (clé invalide) → HTTP %{http_code} (attendu 401)\n" \
  "https://track-prompt.vercel.app/api/v1/groups" -H "Authorization: Bearer pt_live_invalid"
