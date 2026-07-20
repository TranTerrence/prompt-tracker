#!/usr/bin/env bash
# Empaquette l'extension pour les stores : Chrome Web Store, Edge Add-ons
# (même zip que Chrome, soumission séparée au Partner Center) et Firefox AMO
# (manifest transformé : event page + gecko.id ; les permissions d'hôte y sont
# demandées à l'exécution par l'onboarding, pas à l'installation).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(python3 -c "import json; print(json.load(open('$ROOT/extension/manifest.json'))['version'])")"

mkdir -p "$ROOT/dist"

# --- Chrome (référence) ---
OUT_CHROME="$ROOT/dist/prompt-tracker-$VERSION.zip"
rm -f "$OUT_CHROME"
cd "$ROOT/extension"
zip -r -q "$OUT_CHROME" . -x "*.DS_Store" -x "tests/*" -x "prompt-tracker-logo/*" -x "*.zip"
echo "→ $OUT_CHROME"

# --- Edge : strictement le même paquet, nom explicite pour le Partner Center ---
OUT_EDGE="$ROOT/dist/prompt-tracker-edge-$VERSION.zip"
cp "$OUT_CHROME" "$OUT_EDGE"
echo "→ $OUT_EDGE"

# --- Firefox : manifest event page (pas de service worker d'extension chez
# Gecko) + browser_specific_settings. Tout le reste du code est partagé :
# background.js garde importScripts sous garde, supabase.js passe par
# background.scripts. ---
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
rsync -a --exclude ".DS_Store" --exclude "tests" --exclude "prompt-tracker-logo" --exclude "*.zip" "$ROOT/extension/" "$STAGE/"
python3 - "$STAGE/manifest.json" <<'PY'
import json, sys
path = sys.argv[1]
m = json.load(open(path))
m["background"] = {"scripts": ["src/supabase.js", "src/background.js"]}
m["browser_specific_settings"] = {"gecko": {"id": "prompt-tracker@track-prompt.vercel.app", "strict_min_version": "121.0"}}
json.dump(m, open(path, "w"), ensure_ascii=False, indent=2)
PY
OUT_FIREFOX="$ROOT/dist/prompt-tracker-firefox-$VERSION.zip"
rm -f "$OUT_FIREFOX"
cd "$STAGE"
zip -r -q "$OUT_FIREFOX" .
echo "→ $OUT_FIREFOX"

cd "$ROOT/extension"
unzip -l "$OUT_CHROME" | tail -3

# Copie servie par le dashboard : téléchargement direct depuis /install
# (alias stable, mis à jour à chaque paquet ; penser à redéployer).
mkdir -p "$ROOT/dashboard/public/downloads"
cp "$OUT_CHROME" "$ROOT/dashboard/public/downloads/prompt-tracker-latest.zip"
echo "→ dashboard/public/downloads/prompt-tracker-latest.zip"
