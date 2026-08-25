#!/usr/bin/env bash
# Pré-vol Chrome Web Store : tout ce qui est vérifiable par une machine.
# Les motifs de rejet mécaniques (permission non justifiée, code distant,
# version non incrémentée, asset au mauvais format) sont attrapés ici pour que
# la revue humaine ne porte que sur le jugement — cf. .claude/skills/webstore-review/.
#
# Sortie : liste de ✗ (bloquant) et ⚠ (à trancher à la main). Code 1 si bloquant.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT="$ROOT/extension"
FAIL=0
warn() { printf '⚠  %s\n' "$1"; }
fail() { printf '✗  %s\n' "$1"; FAIL=1; }
ok()   { printf '✓  %s\n' "$1"; }

MANIFEST="$EXT/manifest.json"
VERSION="$(python3 -c "import json;print(json.load(open('$MANIFEST'))['version'])")"
echo "── Prompt Tracker $VERSION — pré-vol Chrome Web Store ──"

# 1. Version strictement supérieure au dernier paquet. Le Store refuse un envoi
#    dont la version n'augmente pas ; c'est le rejet le plus bête.
#
#    On compare au plus haut paquet AUTRE que la version courante : dès que
#    package.sh a tourné, dist/ contient forcément un zip à la version du
#    manifest, et comparer à celui-là rendait ce contrôle toujours rouge après
#    empaquetage — donc rouge au moment précis où on le lance vraiment, ce qui
#    masquait les contrôles suivants.
PREV="$(ls "$ROOT/dist"/prompt-tracker-[0-9]*.zip 2>/dev/null \
        | sed 's/.*prompt-tracker-\(.*\)\.zip/\1/' \
        | grep -vx "$VERSION" | sort -V | tail -1)"
if [ -n "$PREV" ]; then
  if [ "$(printf '%s\n%s\n' "$PREV" "$VERSION" | sort -V | tail -1)" != "$VERSION" ]; then
    fail "version $VERSION < paquet existant $PREV — le Store exige une version croissante"
  else
    ok "version $VERSION > $PREV"
  fi
else
  ok "version $VERSION (aucun paquet antérieur dans dist/)"
fi
# Rappel non bloquant : dist/ dit ce qui a été EMPAQUETÉ, pas ce qui a été
# SOUMIS. Seul le Developer Dashboard fait foi.
[ -f "$ROOT/dist/prompt-tracker-$VERSION.zip" ] && \
  warn "un paquet $VERSION existe déjà dans dist/ — vérifier qu'il n'a pas déjà été soumis"

# 2. Code distant : interdit en MV3. Tout script doit être dans le paquet.
if grep -rn "chrome.scripting.executeScript\|document.createElement(['\"]script" "$EXT/src" "$EXT/popup" 2>/dev/null | grep -q "\.js:"; then
  warn "injection de <script> détectée — vérifier qu'aucun code n'est chargé depuis une URL distante"
fi
if grep -rEn "src=[\"']https?://" "$EXT"/**/*.html 2>/dev/null | grep -q .; then
  fail "script/style distant référencé dans un HTML — MV3 interdit le code hébergé à distance"
else
  ok "aucun code distant référencé"
fi
if grep -rn "eval(\|new Function(" "$EXT/src" "$EXT/popup" 2>/dev/null | grep -q "\.js:"; then
  fail "eval() ou new Function() présent — rejet automatique en MV3"
else
  ok "pas d'eval / new Function"
fi

# 3. Chaque permission déclarée doit être réellement utilisée ET justifiée dans
#    store/SUBMISSION.md (le Store demande une justification par permission).
PERMS="$(python3 -c "
import json;m=json.load(open('$MANIFEST'))
print(' '.join(m.get('permissions',[])+m.get('host_permissions',[])+m.get('optional_host_permissions',[])))")"
PERM_FAIL=0
for p in $PERMS; do
  case "$p" in
    storage)  USED=$(grep -rl "chrome.storage" "$EXT/src" "$EXT/popup" 2>/dev/null | head -1) ;;
    alarms)   USED=$(grep -rl "chrome.alarms" "$EXT/src" 2>/dev/null | head -1) ;;
    tabs)     USED=$(grep -rl "chrome.tabs" "$EXT/src" "$EXT/popup" 2>/dev/null | head -1) ;;
    # Une permission d'hôte FACULTATIVE n'est légitime que si le code la
    # demande explicitement à l'exécution. Sans appel à permissions.request,
    # elle est soit morte, soit demandée par un chemin qu'on n'a pas vu.
    https://*/*|http*) USED=$(grep -rl "permissions.request" "$EXT/src" "$EXT/popup" 2>/dev/null | head -1) ;;
    *)        USED="?" ;;
  esac
  [ -z "$USED" ] && { fail "permission « $p » déclarée mais jamais utilisée dans le code — la retirer"; PERM_FAIL=1; }
  # -F obligatoire : un motif d'hôte contient des « * », que grep lirait comme
  # des quantificateurs — « https://*/* » ne se trouverait alors jamais.
  grep -qF "\`$p\`" "$ROOT/store/SUBMISSION.md" 2>/dev/null \
    || { fail "permission « $p » sans justification dans store/SUBMISSION.md"; PERM_FAIL=1; }
done
[ $PERM_FAIL -eq 0 ] && ok "permissions ($PERMS) utilisées et justifiées"

# 4. Assets : icône 128 obligatoire, captures 1280x800 ou 640x400 exactement,
#    entre 1 et 5 captures retenues pour la fiche.
python3 - "$EXT" "$ROOT/store/screenshots" <<'PY'
import sys, os, struct, glob
ext, shots = sys.argv[1], sys.argv[2]
def dims(p):
    with open(p,'rb') as f: return struct.unpack('>II', f.read(33)[16:24])
bad = 0
if not os.path.exists(os.path.join(ext,'icons','icon128.png')):
    print("✗  icon128.png manquant — obligatoire pour la fiche"); bad = 1
for p in sorted(glob.glob(os.path.join(shots,'*.png'))):
    w,h = dims(p)
    if (w,h) not in ((1280,800),(640,400)):
        print(f"✗  {os.path.basename(p)} en {w}x{h} — le Store exige 1280x800 ou 640x400"); bad = 1
n = len(glob.glob(os.path.join(shots,'*.png')))
if n == 0: print("✗  aucune capture d'écran"); bad = 1
elif n > 5: print(f"⚠  {n} captures présentes, la fiche n'en accepte que 5 — choisir lesquelles")
if not bad: print("✓  icônes et captures au bon format")
PY

# 5. Fiche : le résumé du Store est coupé à 132 caractères.
python3 - "$ROOT/store" <<'PY'
import sys, os, re
for f in ('description-fr.md','description-en.md'):
    p = os.path.join(sys.argv[1], f)
    if not os.path.exists(p): print(f"✗  {f} manquant"); continue
    txt = open(p, encoding='utf-8').read()
    m = re.search(r'##\s*(?:Résumé|Summary).*?\n+(.+)', txt)
    if not m: print(f"⚠  {f} : section Résumé introuvable"); continue
    s = m.group(1).strip()
    print((f"✗  {f} : résumé de {len(s)} car. (max 132)" if len(s) > 132
           else f"✓  {f} : résumé {len(s)}/132 car."))
PY

# 6. Politique de confidentialité : URL obligatoire et joignable, et la fiche
#    doit la citer. Une URL morte = rejet « privacy policy not accessible ».
PRIVACY="$(grep -ho "https://[^ )]*privacy" "$ROOT/store"/description-*.md 2>/dev/null | head -1)"
if [ -z "$PRIVACY" ]; then
  fail "aucune URL de politique de confidentialité dans store/description-*.md"
else
  CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$PRIVACY" || echo 000)"
  [ "$CODE" = "200" ] && ok "politique de confidentialité joignable ($PRIVACY)" \
                      || fail "politique injoignable (HTTP $CODE) : $PRIVACY"
fi

# 7. Hygiène du paquet : ni tests, ni sources de dev dans le zip.
if [ -f "$ROOT/dist/prompt-tracker-$VERSION.zip" ]; then
  LEAK="$(unzip -l "$ROOT/dist/prompt-tracker-$VERSION.zip" | grep -cE "tests/|\.map$|\.DS_Store" || true)"
  [ "$LEAK" -gt 0 ] && fail "le zip contient des fichiers de dev (tests/, .map, .DS_Store)" \
                    || ok "zip propre"
fi

# 8. Copie Safari alignée. Elle n'entre pas dans le zip Chrome, mais la laisser
#    dériver revient à publier deux produits différents sous le même nom — et
#    c'est arrivé : sept fichiers d'écart, silencieusement.
if [ -x "$ROOT/scripts/sync-safari.sh" ]; then
  if "$ROOT/scripts/sync-safari.sh" --check >/dev/null 2>&1; then
    ok "copie Safari alignée sur extension/"
  else
    fail "la copie Safari a dérivé — lancer ./scripts/sync-safari.sh"
  fi
fi

echo "──"
[ $FAIL -eq 0 ] && echo "Pré-vol mécanique OK. Passer à la revue de jugement (skill webstore-review)." \
                || echo "Bloquants ci-dessus à corriger AVANT de soumettre."
exit $FAIL
