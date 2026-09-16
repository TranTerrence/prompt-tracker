#!/usr/bin/env bash
# Empaquette l'extension pour les stores : Chrome Web Store, Edge Add-ons
# (même zip que Chrome, soumission séparée au Partner Center) et Firefox AMO
# (manifest transformé : event page + gecko.id ; les permissions d'hôte y sont
# demandées à l'exécution par l'onboarding, pas à l'installation).
# Le portage Safari a été retiré le 26/08/2026 (projet Xcode + sync dans
# l'historique git) : copie complète à resynchroniser à chaque livraison,
# sans signal de demande.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(python3 -c "import json; print(json.load(open('$ROOT/extension/manifest.json'))['version'])")"

# Garde-fou : les trois constantes de src/config.js doivent viser la
# production (https). Un paquet empaqueté avec la stack locale de dev serait
# muet chez tous les étudiants, et c'est exactement le genre d'erreur qu'on
# ne voit qu'après la revue du store.
python3 - "$ROOT/extension/src/config.js" <<'PY'
import re, sys
src = open(sys.argv[1], encoding="utf-8").read()
bad = []
for name in ("SUPABASE_URL", "APP_URL"):
    m = re.search(r'%s: "([^"]*)"' % name, src)
    if not m or not m.group(1).startswith("https://"):
        bad.append(f"{name} = {m.group(1) if m else '<introuvable>'}")
if bad:
    print("✗  src/config.js pointe sur une stack non-https : " + ", ".join(bad), file=sys.stderr)
    print("   Remettre les valeurs de production avant d'empaqueter.", file=sys.stderr)
    sys.exit(1)
PY

# Même garde-fou pour le manifest : viser la stack locale demande d'ajouter
# `http://localhost:3200/*` aux permissions d'hôte et aux matches du content
# script de présence (README, « Viser une autre stack »). Empaqueté, ce motif
# ferait rejeter la soumission — une permission d'hôte sur localhost est
# exactement ce que la revue du store lit en premier.
python3 - "$ROOT/extension/manifest.json" <<'PYMANIFEST'
import json, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
patterns = []
for key in ("host_permissions", "optional_host_permissions"):
    patterns += [(key, p) for p in m.get(key, [])]
for cs in m.get("content_scripts", []):
    patterns += [("content_scripts.matches", p) for p in cs.get("matches", [])]
bad = ["%s → %s" % (key, pat) for key, pat in patterns if pat.startswith("http://")]
if bad:
    print("✗  extension/manifest.json déclare des origines en http:// : " + ", ".join(bad), file=sys.stderr)
    print("   Retirer les motifs de dev avant d'empaqueter.", file=sys.stderr)
    sys.exit(1)
PYMANIFEST

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
# background.js garde importScripts sous garde, config.js puis supabase.js
# passent par background.scripts. ---
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
rsync -a --exclude ".DS_Store" --exclude "tests" --exclude "prompt-tracker-logo" --exclude "*.zip" "$ROOT/extension/" "$STAGE/"
python3 - "$STAGE/manifest.json" <<'PY'
import json, sys
path = sys.argv[1]
m = json.load(open(path))
m["background"] = {"scripts": ["src/config.js", "src/supabase.js", "src/background.js"]}
# 127 minimum : optional_host_permissions n'existe chez Gecko que depuis
# Firefox 127 — en dessous, la clé est ignorée et permissions.request sur une
# origine (bibliothèque de prompts) est rejeté comme non déclaré.
m["browser_specific_settings"] = {"gecko": {"id": "prompt-tracker@track-prompt.vercel.app", "strict_min_version": "127.0"}}
json.dump(m, open(path, "w"), ensure_ascii=False, indent=2)
PY
OUT_FIREFOX="$ROOT/dist/prompt-tracker-firefox-$VERSION.zip"
rm -f "$OUT_FIREFOX"
cd "$STAGE"
zip -r -q "$OUT_FIREFOX" .
echo "→ $OUT_FIREFOX"

cd "$ROOT/extension"
unzip -l "$OUT_CHROME" | tail -3

# Le zip Chrome est servi aux étudiants par l'app I-BE³ Companion
# (companion.mines.paris/extension lit public/prompt-tracker-<version>.zip et
# lib/extension-release.ts). Le dashboard de ce dépôt n'est plus déployé :
# plus de copie vers dashboard/public ni de extension-version.json.
# Si IBE3_PUBLIC_DIR pointe sur le dossier public/ de l'app, on y dépose le
# paquet ; sinon on imprime le chemin, à copier à la main.
if [ -n "${IBE3_PUBLIC_DIR:-}" ]; then
  mkdir -p "$IBE3_PUBLIC_DIR"
  cp "$OUT_CHROME" "$IBE3_PUBLIC_DIR/prompt-tracker-$VERSION.zip"
  echo "→ $IBE3_PUBLIC_DIR/prompt-tracker-$VERSION.zip (penser à ready: true dans lib/extension-release.ts, puis déployer)"
else
  echo "Paquet Chrome à déposer dans public/ de l'app I-BE³ Companion : $OUT_CHROME"
  echo "(ou relancer avec IBE3_PUBLIC_DIR=/chemin/vers/ibe3-companion/public)"
fi
