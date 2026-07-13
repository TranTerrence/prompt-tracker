#!/usr/bin/env bash
# Applique le schéma + seed sur le projet Supabase cible via l'API Management.
# Usage : SUPABASE_ACCESS_TOKEN=sbp_… ./scripts/apply-supabase-migration.sh
# Le jeton (Account → Access Tokens sur supabase.com) doit appartenir au
# compte propriétaire du projet cible. Rien n'est touché sur l'ancienne base.
set -euo pipefail

PROJECT_REF="${PROJECT_REF:-ovbvwawzrciwpudnaysp}"
API="https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query"
DIR="$(cd "$(dirname "$0")/.." && pwd)/dashboard/supabase"

[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] || { echo "SUPABASE_ACCESS_TOKEN manquant (sbp_…)"; exit 1; }

run_sql_file() {
  local file="$1"
  echo "→ $file"
  python3 - "$file" <<'PY' | curl -sS -X POST "$API_URL" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      --data-binary @- | head -c 400
import json, sys
print(json.dumps({"query": open(sys.argv[1]).read()}))
PY
  echo ""
}

export API_URL="$API"
run_sql_file "$DIR/migrations/0001_init.sql"
run_sql_file "$DIR/seed.sql"

echo "→ vérification"
curl -sS -X POST "$API" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"select table_name from information_schema.tables where table_schema = '\''public'\'' order by 1;"}'
echo ""
echo "OK. Prochaines étapes : inscription du compte admin puis UPDATE profiles (voir dashboard/supabase/MIGRATION.md)."
