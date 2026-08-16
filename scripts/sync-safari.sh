#!/usr/bin/env bash
# Aligne la copie Safari sur extension/ (source de vérité).
#
# `safari/Prompt Tracker/Shared (Extension)/Resources/` est une copie du code
# de l'extension, que le projet Xcode embarque. Rien ne la synchronisait : elle
# avait dérivé de sept fichiers (dont tout le barème socratique par niveaux et
# les mesures post-réponse), sans que personne ne le voie.
#
# Usage :
#   ./scripts/sync-safari.sh          copie extension/ → safari/
#   ./scripts/sync-safari.sh --check  échoue si un écart subsiste (pré-vol)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/extension/"
DST="$ROOT/safari/Prompt Tracker/Shared (Extension)/Resources/"

# Exclusions : le superflu de paquet, et les répertoires qui n'ont pas leur
# place dans un bundle d'application.
EXCLUDES=(
  --exclude ".DS_Store"
  --exclude "tests"
  --exclude "prompt-tracker-logo"
  --exclude "*.zip"
  --exclude "fonts"
)

if [ ! -d "$DST" ]; then
  echo "✗  copie Safari introuvable : $DST" >&2
  exit 1
fi

if [ "${1:-}" = "--check" ]; then
  # --checksum : on compare le CONTENU, pas les dates. Une copie identique
  # recopiée reste identique, et un fichier retouché puis restauré ne fait pas
  # échouer le pré-vol pour rien.
  DIFF="$(rsync -rin --checksum "${EXCLUDES[@]}" "$SRC" "$DST" | grep -v '^\.' || true)"
  if [ -n "$DIFF" ]; then
    echo "✗  la copie Safari a dérivé de extension/ :"
    echo "$DIFF" | sed 's/^/     /'
    echo "     → lancer ./scripts/sync-safari.sh"
    exit 1
  fi
  echo "✓  copie Safari alignée sur extension/"
  exit 0
fi

# -t préserve les dates : sans lui, chaque copie repart avec l'heure courante
# et le contrôle ci-dessus signalerait un écart à chaque passage.
rsync -rti "${EXCLUDES[@]}" "$SRC" "$DST" | sed 's/^/  /'
echo "✓  copie Safari alignée sur extension/"
