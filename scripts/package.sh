#!/usr/bin/env bash
# Empaquette l'extension pour le Chrome Web Store.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(python3 -c "import json; print(json.load(open('$ROOT/extension/manifest.json'))['version'])")"
OUT="$ROOT/dist/prompt-tracker-$VERSION.zip"

mkdir -p "$ROOT/dist"
rm -f "$OUT"
cd "$ROOT/extension"
zip -r -q "$OUT" . -x "*.DS_Store" -x "tests/*"
echo "→ $OUT"
unzip -l "$OUT" | tail -3
