#!/usr/bin/env bash
# Empaquette l'extension pour le Chrome Web Store.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(python3 -c "import json; print(json.load(open('$ROOT/extension/manifest.json'))['version'])")"
OUT="$ROOT/dist/prompt-tracker-$VERSION.zip"

mkdir -p "$ROOT/dist"
rm -f "$OUT"
cd "$ROOT/extension"
zip -r -q "$OUT" . -x "*.DS_Store" -x "tests/*" -x "prompt-tracker-logo/*" -x "*.zip"
echo "→ $OUT"
unzip -l "$OUT" | tail -3

# Copie servie par le dashboard : téléchargement direct depuis /install
# (alias stable, mis à jour à chaque paquet ; penser à redéployer).
mkdir -p "$ROOT/dashboard/public/downloads"
cp "$OUT" "$ROOT/dashboard/public/downloads/prompt-tracker-latest.zip"
echo "→ dashboard/public/downloads/prompt-tracker-latest.zip"
