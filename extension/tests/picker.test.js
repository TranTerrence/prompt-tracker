// Tests du sélecteur de prompts (1.0.3) : node extension/tests/picker.test.js
// Zéro dépendance : assert natif, chargement par eval indirect ou sandbox
// `new Function`, comme les autres tests du dépôt.
//
// Trois couches, du plus pur au plus câblé :
//   1. CoachLibrary (src/library.js), sans DOM ni chrome.* : c'est lui qui
//      décide ce que le sélecteur montre, dans quel ordre, et ce qu'il écrit
//      dans le composeur. Une erreur ici se voit sur les cinq sites à la fois.
//   2. Le câblage : manifest (ordre de chargement, raccourci), locales.
//   3. Les deux bouts du fil : content.js reçoit `picker-insert`, le worker
//      reçoit `library-used`. Pas de site réel ici, seulement les contrats.
//
// L'INVARIANT CENTRAL : le sélecteur n'ENVOIE jamais. Il remplace ou complète
// le composeur, et rend la main. Aucun test ici ne voit passer submitText.

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

globalThis.self = globalThis;
(0, eval)(read("src/library.js"));
const L = globalThis.CoachLibrary;
assert.strictEqual(typeof L, "object", "CoachLibrary doit être exposé sur self");

/* ---------- Jeu de données ---------- */

const P = {
  off1: { id: "6f0b7c3e-1111-4a2b-9c3d-000000000001", kind: "official", title: "Cadrer une dissertation", body: "Je prépare une dissertation sur [SUJET].", category: "rédaction", copies: 3, helpful: null, author: null, lang: "fr" },
  off2: { id: "6f0b7c3e-1111-4a2b-9c3d-000000000002", kind: "official", title: "Vérifier un résumé", body: "Voici mon résumé : …", category: "analyse", copies: 40, helpful: null, author: null, lang: "fr" },
  peer1: { id: "6f0b7c3e-2222-4a2b-9c3d-000000000003", kind: "peer", title: "Débugger sans la solution", body: "Voici mon code et l'erreur.", category: "code", copies: 12, helpful: 4, author: "Léa", lang: "fr" },
  peer2: { id: "6f0b7c3e-2222-4a2b-9c3d-000000000004", kind: "peer", title: "Plan en trois parties", body: "Je prépare une dissertation : où le plan dérape ?", category: "rédaction", copies: 27, helpful: 9, author: null, lang: "fr" },
  slug: { id: "school-intro", kind: "official", title: "Intro de l'école", body: "Présente-toi à l'IA.", category: null, copies: null, helpful: null, author: null, lang: null },
};
const ALL = [P.off1, P.peer1, P.off2, P.peer2, P.slug];

/* ---------- normSearch : sans accents, sans casse ---------- */

assert.strictEqual(L.normSearch("Rédaction Élève"), "redaction eleve");
assert.strictEqual(L.normSearch(""), "");
assert.strictEqual(L.normSearch(null), "", "null ne lève pas");

/* ---------- matches : chaque jeton, sur titre + corps + catégorie + auteur ---------- */

assert.ok(L.matches(P.off1, "dissertation"), "sur le corps");
assert.ok(L.matches(P.off1, "cadrer"), "sur le titre");
assert.ok(L.matches(P.off1, "redaction"), "catégorie, sans accent");
assert.ok(L.matches(P.peer1, "léa"), "auteur, avec accent dans la requête");
assert.ok(L.matches(P.off1, "  Dissertation   SUJET "), "plusieurs jetons, tous présents (ET)");
assert.ok(!L.matches(P.off1, "dissertation code"), "un jeton absent suffit à écarter");
assert.ok(L.matches(P.off1, ""), "requête vide : tout passe");
assert.ok(L.matches(P.off1, "   "), "requête blanche : tout passe");

/* ---------- sortLibrary : officiels d'abord, puis les plus repris ---------- */

assert.deepStrictEqual(
  L.sortLibrary(ALL).map((p) => p.id),
  [P.off2.id, P.off1.id, P.slug.id, P.peer2.id, P.peer1.id],
  "officiels devant, reprises décroissantes, null vaut 0"
);
assert.deepStrictEqual(L.sortLibrary(null), [], "null → []");
const before = [...ALL];
L.sortLibrary(ALL);
assert.deepStrictEqual(ALL, before, "ne trie pas en place");

/* ---------- groupLibrary : chaque prompt une fois, premier groupe qui le prend ---------- */

{
  const groups = L.groupLibrary({
    prompts: ALL,
    starred: [P.peer1.id, P.off1.id, "inconnu"],
    recent: [P.off1.id, P.peer2.id, "fantôme", P.off2.id],
    query: "",
  });
  assert.deepStrictEqual(
    groups.map((g) => g.key),
    ["starred", "recent", "official"],
    "ordre des groupes ; aucun pair restant → le groupe « peer » est omis"
  );
  const ids = (k) => groups.find((g) => g.key === k).items.map((p) => p.id);
  assert.deepStrictEqual(ids("starred"), [P.off1.id, P.peer1.id], "favoris : tri bibliothèque, ids inconnus ignorés");
  assert.deepStrictEqual(ids("recent"), [P.peer2.id, P.off2.id], "récents : ordre de récence, sans ceux déjà en favoris");
  assert.deepStrictEqual(ids("official"), [P.slug.id], "officiels restants");
  const seen = groups.flatMap((g) => g.items.map((p) => p.id));
  assert.strictEqual(new Set(seen).size, seen.length, "aucun doublon");
  assert.strictEqual(seen.length, ALL.length, "tout le monde est là");
}

{
  // Groupes vides omis, y compris quand rien n'est marqué.
  const groups = L.groupLibrary({ prompts: ALL, starred: null, recent: null, query: "" });
  assert.deepStrictEqual(groups.map((g) => g.key), ["official", "peer"]);
  assert.deepStrictEqual(
    groups[0].items.map((p) => p.id),
    [P.off2.id, P.off1.id, P.slug.id],
    "officiels par reprises décroissantes"
  );
}

{
  // La recherche s'applique DANS les groupes ; un groupe vidé disparaît.
  const groups = L.groupLibrary({ prompts: ALL, starred: [P.peer1.id], recent: [P.off2.id], query: "dissertation" });
  assert.deepStrictEqual(groups.map((g) => g.key), ["official", "peer"], "favori et récent ne matchent pas → omis");
  assert.deepStrictEqual(groups[0].items.map((p) => p.id), [P.off1.id]);
  assert.deepStrictEqual(groups[1].items.map((p) => p.id), [P.peer2.id]);
  assert.deepStrictEqual(L.groupLibrary({ prompts: ALL, query: "zzz" }), [], "aucun résultat → []");
  assert.deepStrictEqual(L.groupLibrary({ prompts: null }), [], "bibliothèque absente → []");
  assert.deepStrictEqual(L.groupLibrary({ prompts: [] }), [], "bibliothèque vide → []");
}

{
  // Un Set de favoris est accepté (c'est ce que le sélecteur construit).
  const groups = L.groupLibrary({ prompts: ALL, starred: new Set([P.slug.id]), recent: [] });
  assert.deepStrictEqual(groups[0].items.map((p) => p.id), [P.slug.id]);
}

/* ---------- flatten : l'ordre clavier est l'ordre d'affichage ---------- */

{
  const groups = L.groupLibrary({ prompts: ALL, starred: [P.peer1.id], recent: [P.off2.id] });
  const flat = L.flatten(groups);
  assert.deepStrictEqual(
    flat.map((p) => p.id),
    [P.peer1.id, P.off2.id, P.off1.id, P.slug.id, P.peer2.id]
  );
  assert.deepStrictEqual(L.flatten([]), []);
  assert.deepStrictEqual(L.flatten(null), []);
}

/* ---------- mergeInsert : remplacer le vide, compléter le brouillon ---------- */

assert.strictEqual(L.mergeInsert("", "Corps"), "Corps", "composeur vide → le corps seul");
assert.strictEqual(L.mergeInsert("   \n", "Corps"), "Corps", "blancs seuls = vide");
assert.strictEqual(L.mergeInsert(null, "Corps"), "Corps");
assert.strictEqual(L.mergeInsert("hello", "Corps"), "hello\n\nCorps", "brouillon gardé, une ligne vide, puis le corps");
assert.strictEqual(L.mergeInsert("hello  \n\n", "Corps \n"), "hello\n\nCorps", "blancs de fin retirés des deux côtés");
assert.strictEqual(L.mergeInsert("hello", "  indenté"), "hello\n\n  indenté", "les blancs de tête du corps sont gardés");

/* ---------- slashTrigger : « // » tapé, et rien d'autre ---------- */

assert.ok(L.slashTrigger({ text: "//", inputType: "insertText", isComposing: false }), "le cas nominal");
assert.ok(L.slashTrigger({ text: "  //  ", inputType: "insertText", isComposing: false }), "blancs autour tolérés");
assert.ok(L.slashTrigger({ text: "//" }), "inputType absent (Event générique, textarea) : accepté");
assert.ok(!L.slashTrigger({ text: "//", inputType: "insertFromPaste" }), "collage : jamais");
assert.ok(!L.slashTrigger({ text: "//", inputType: "insertText", isComposing: true }), "IME en composition : jamais");
assert.ok(!L.slashTrigger({ text: "//", inputType: "insertCompositionText" }), "texte de composition : jamais");
assert.ok(!L.slashTrigger({ text: "//", inputType: "historyUndo" }), "annulation : jamais");
assert.ok(!L.slashTrigger({ text: "//", inputType: "insertReplacementText" }), "autocorrection : jamais");
assert.ok(!L.slashTrigger({ text: "//x", inputType: "insertText" }), "« //x » n'est pas le déclencheur");
assert.ok(!L.slashTrigger({ text: "x //", inputType: "insertText" }), "« x // » non plus");
assert.ok(!L.slashTrigger({ text: "// todo", inputType: "insertText" }), "un commentaire de code non plus");
assert.ok(!L.slashTrigger({ text: "https://", inputType: "insertText" }), "une URL non plus");
assert.ok(!L.slashTrigger({ text: "/", inputType: "insertText" }), "un seul slash : c'est le menu du site, pas le nôtre");
assert.ok(!L.slashTrigger({ text: "", inputType: "insertText" }), "vide");
assert.ok(!L.slashTrigger({}), "sans texte");
assert.ok(!L.slashTrigger(null), "null ne lève pas");

/* ---------- pushRecent : en tête, sans doublon, plafonné ---------- */

assert.deepStrictEqual(L.pushRecent([], "a"), ["a"]);
assert.deepStrictEqual(L.pushRecent(["a", "b"], "c"), ["c", "a", "b"], "le plus récent en tête");
assert.deepStrictEqual(L.pushRecent(["a", "b", "c"], "b"), ["b", "a", "c"], "réinséré en tête, une seule fois");
assert.deepStrictEqual(L.pushRecent(null, "a"), ["a"], "liste absente");
assert.deepStrictEqual(L.pushRecent(["a"], ""), ["a"], "id vide ignoré");
assert.deepStrictEqual(L.pushRecent(["a"], null), ["a"], "id null ignoré");
{
  let list = [];
  for (let i = 0; i < 25; i++) list = L.pushRecent(list, `p${i}`);
  assert.strictEqual(list.length, L.RECENT_MAX, "plafonné à RECENT_MAX");
  assert.strictEqual(L.RECENT_MAX, 10);
  assert.strictEqual(list[0], "p24");
  assert.strictEqual(list[9], "p15");
}
{
  const input = ["a", "b"];
  L.pushRecent(input, "c");
  assert.deepStrictEqual(input, ["a", "b"], "ne mute pas l'entrée");
}

/* ---------- isUuid : seuls les ids Postgres appellent la RPC ---------- */

assert.ok(L.isUuid("6f0b7c3e-1111-4a2b-9c3d-000000000001"));
assert.ok(L.isUuid("6F0B7C3E-1111-4A2B-9C3D-000000000001"), "majuscules acceptées");
assert.ok(!L.isUuid("school-intro"), "slug d'un flux d'organisation");
assert.ok(!L.isUuid("p0"), "id de rang fabriqué par normalizeLibrary");
assert.ok(!L.isUuid(""));
assert.ok(!L.isUuid(null));
assert.ok(!L.isUuid(42));

/* ---------- shortcutLabel : la corde affichée suit la plateforme ---------- */

assert.strictEqual(L.shortcutLabel("MacIntel"), "⌘⇧.");
assert.strictEqual(L.shortcutLabel("iPad"), "⌘⇧.");
assert.strictEqual(L.shortcutLabel("Win32"), "Ctrl+Shift+.");
assert.strictEqual(L.shortcutLabel("Linux x86_64"), "Ctrl+Shift+.");
assert.strictEqual(L.shortcutLabel(undefined), "Ctrl+Shift+.");

console.log("  ✓ CoachLibrary : recherche, groupes, fusion, déclencheur, récents");

/* =====================================================================
   2. Câblage : manifest, locales, paquet Firefox, popup, i18n
   ===================================================================== */

{
  const manifest = JSON.parse(read("manifest.json"));
  assert.strictEqual(manifest.version, "1.0.3", "version 1.0.3");

  const siteEntries = manifest.content_scripts.filter((cs) => cs.js.includes("src/content.js"));
  assert.strictEqual(siteEntries.length, 5, "cinq sites");
  for (const cs of siteEntries) {
    const js = cs.js;
    const factory = js.indexOf("src/adapters/factory.js");
    const adapter = js.findIndex((f, i) => i > factory && f.startsWith("src/adapters/"));
    const lib = js.indexOf("src/library.js");
    const picker = js.indexOf("src/picker.js");
    const config = js.indexOf("src/config.js");
    const content = js.indexOf("src/content.js");
    assert.ok(factory >= 0 && adapter > factory, `${cs.matches[0]} : factory puis adaptateur du site`);
    // library.js puis picker.js, après l'adaptateur du site (qui déclare
    // CoachAdapter) et avant config.js / content.js (qui les consomment).
    assert.strictEqual(lib, adapter + 1, `${cs.matches[0]} : library.js juste après l'adaptateur`);
    assert.strictEqual(picker, lib + 1, `${cs.matches[0]} : picker.js juste après library.js`);
    assert.strictEqual(config, picker + 1, `${cs.matches[0]} : config.js ensuite`);
    assert.ok(content > config, `${cs.matches[0]} : content.js en dernier`);
    // picker.js s'appuie sur i18n, theme, mirror (flash) et library : tous avant.
    for (const dep of ["src/i18n.js", "src/theme.js", "src/mirror.js", "src/library.js"]) {
      assert.ok(js.indexOf(dep) < picker, `${cs.matches[0]} : ${dep} chargé avant picker.js`);
    }
  }
  // L'entrée de présence (origine de l'app) ne charge rien de plus.
  const presence = manifest.content_scripts.find((cs) => cs.js.includes("src/presence.js"));
  assert.deepStrictEqual(presence.js, ["src/presence.js"], "presence.js reste seul sur l'origine de l'app");

  const cmd = manifest.commands && manifest.commands["open-prompt-picker"];
  assert.ok(cmd, "commande open-prompt-picker déclarée");
  assert.strictEqual(cmd.suggested_key.default, "Ctrl+Shift+Period");
  assert.strictEqual(cmd.suggested_key.mac, "Command+Shift+Period");
  assert.strictEqual(cmd.description, "__MSG_cmdOpenPicker__");
  // `commands` n'est pas une permission : rien n'a bougé là.
  assert.deepStrictEqual(manifest.permissions, ["storage", "alarms"], "aucune permission nouvelle");

  for (const locale of ["en", "fr"]) {
    const messages = JSON.parse(read(`_locales/${locale}/messages.json`));
    assert.ok(messages.cmdOpenPicker && messages.cmdOpenPicker.message, `_locales/${locale} définit cmdOpenPicker`);
  }

  // Paquet Firefox : library.js dans background.scripts, avant background.js.
  const pkg = fs.readFileSync(path.join(__dirname, "..", "..", "scripts", "package.sh"), "utf8");
  const scripts = pkg.match(/"scripts":\s*\[([^\]]*)\]/);
  assert.ok(scripts, "package.sh déclare background.scripts pour Gecko");
  const list = scripts[1].match(/"([^"]+)"/g).map((s) => s.replace(/"/g, ""));
  assert.ok(list.indexOf("src/library.js") > list.indexOf("src/supabase.js"), "library.js après supabase.js");
  assert.ok(list.indexOf("src/library.js") < list.indexOf("src/background.js"), "library.js avant background.js");

  // Popup : library.js chargé avant popup.js.
  const popupHtml = read("popup/popup.html");
  assert.ok(popupHtml.indexOf("../src/library.js") < popupHtml.indexOf("popup.js\""), "popup.html charge library.js avant popup.js");

  // i18n : chaque clé nouvelle existe dans LES DEUX tables (fr et en).
  const i18n = read("src/i18n.js");
  const keys = [
    "pickerTitle", "pickerSearch", "pickerHint", "pickerClose", "pickerGroupStarred", "pickerGroupRecent",
    "pickerGroupOfficial", "pickerGroupPeer", "pickerCopy", "pickerInsert", "pickerManage", "pickerNotReady",
    "pickerEmpty", "pickerNoMatch", "pickerCopied", "pickerCopiedFallback", "badgePrompts", "badgePromptsTitle",
    "libraryInsert", "libraryCopy", "libraryInserted", "libraryInsertFailed", "libraryInsertUnavailable",
    "libraryPanelNoteInsert",
  ];
  for (const k of keys) {
    const n = (i18n.match(new RegExp(`^\\s+${k}:`, "gm")) || []).length;
    assert.strictEqual(n, 2, `i18n : ${k} présent en fr ET en en (${n})`);
  }
  // Anglais britannique, pas de tiret cadratin dans les chaînes nouvelles.
  const enTable = i18n.slice(i18n.indexOf("    en: {"));
  for (const k of keys) {
    const m = enTable.match(new RegExp(`^\\s+${k}:([^\\n]*)`, "m"));
    assert.ok(m && !m[1].includes("—"), `i18n en : ${k} sans tiret cadratin`);
  }
}
console.log("  ✓ câblage : manifest 1.0.3 (ordre de chargement, commande), locales, Firefox, popup, i18n");

/* =====================================================================
   3. content.js : les deux entrées du sélecteur, sans site réel
   ===================================================================== */

// Même sandbox que capture.test.js : content.js est une IIFE qui parle à
// chrome.* et aux modules Coach* ; on les simule, on charge le vrai fichier,
// et on capture ce qu'il enregistre (écouteur `input`, rappels de message,
// appels à l'adaptateur et au sélecteur).
function makeContentEnv({ disclosure = true, composerText = "", healthy = true, verify = true, modalOpen = false } = {}) {
  const store = {
    settings: { captureMode: "metadata", interceptEnabled: true, threshold: 40, theme: "light" },
    orgConfig: { orgId: "o", libraryUrl: "https://app.example/api/prompt-library", branding: { name: "École", color: "#123456" } },
    consents: {},
    disclosure: disclosure ? { accepted: true, version: 3 } : null,
    events: [],
  };
  const captured = { sent: [], listeners: [], inputListener: null, opened: [], closed: [], cleared: 0, focused: 0, submitted: [] };
  const composer = { text: composerText, healthy };
  const picker = { open: false };

  const chrome = {
    storage: {
      local: {
        get(keys, cb) {
          const out = {};
          for (const k of Array.isArray(keys) ? keys : [keys]) if (k in store) out[k] = store[k];
          cb(out);
        },
        set(obj, cb) { Object.assign(store, obj); cb && cb(); },
        remove(keys, cb) { for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k]; cb && cb(); },
      },
      onChanged: { addListener() {} },
    },
    runtime: {
      sendMessage(m, cb) {
        captured.sent.push(m);
        // library-fetch : le worker répond une liste ; le reste, un ok neutre.
        if (m && m.type === "library-fetch") return cb && cb({ prompts: ALL, starred: null });
        cb && cb({ ok: true });
      },
      onMessage: { addListener(fn) { captured.listeners.push(fn); } },
      lastError: null,
      getURL: (p) => p,
    },
  };

  const adapter = {
    site: "chatgpt",
    conversationKey: () => "chatgpt:c/abc",
    isNewConversation: () => false,
    onResponse() {},
    armResponseWatch() {},
    submitText(text) { captured.submitted.push(text); return Promise.resolve(true); },
    send() { captured.submitted.push("<send>"); return true; },
    healthy: () => composer.healthy,
    probe: () => ({ assistant: true, model: true }),
    init(handlers) { this.handlers = handlers; },
    readComposerText: () => composer.text.trim(),
    setComposerText(text) { composer.text = text; return verify; },
    clearComposer() { captured.cleared++; composer.text = ""; return true; },
    focusComposer() { captured.focused++; return true; },
    isComposerEvent: (e) => Boolean(e && e.fromComposer),
  };

  const sandbox = {
    chrome,
    self: {},
    document: {
      addEventListener(type, fn, capture) {
        if (type === "input" && capture === true) captured.inputListener = fn;
      },
    },
    navigator: { platform: "MacIntel" },
    setTimeout: (fn, ms) => (ms >= 5000 ? null : setTimeout(fn, ms)),
    clearTimeout,
    Date, Math, Set, Map, Promise, Boolean, Number, String, Array, Object, JSON, console,
    CoachAdapter: adapter,
    CoachTheme: { set() {}, DEFAULT_ACCENT: "#000" },
    CoachBadge: { render(state) { captured.badge = state; }, remove() {} },
    CoachModels: { VERSION: 1 },
    CoachConfig: { APP_URL: "https://app.example" },
    CoachPicker: {
      isOpen: () => picker.open,
      open(opts) { captured.opened.push(opts); picker.open = true; return true; },
      update(prompts) { captured.updated = prompts; },
      close(reason) { captured.closed.push(reason); picker.open = false; },
    },
    CoachMirror: {
      show() {}, flash(msg) { captured.flash = msg; }, showPost() {}, closePost() {},
      showModal(opts) { captured.modal = opts; }, closeModal() {},
      isModalOpen: () => modalOpen,
      onFeedback: null, onClose: null, onPause: null,
    },
  };
  const bootstrap = read("src/scoring.js") + "\n" + read("src/i18n.js") + "\n" + read("src/library.js") + "\n" + read("src/content.js");
  const keys = Object.keys(sandbox);
  new Function(...keys, bootstrap)(...keys.map((k) => sandbox[k]));

  const message = (msg) => {
    const responses = [];
    for (const fn of captured.listeners) fn(msg, {}, (r) => responses.push(r));
    return responses;
  };
  const used = () => captured.sent.filter((m) => m.type === "library-used");
  return { store, captured, composer, picker, adapter, message, used };
}

/* ---------- picker-insert : les formes de réponse ---------- */

{
  const env = makeContentEnv();
  const res = env.message({ type: "picker-insert", id: P.off1.id, title: P.off1.title, body: P.off1.body });
  assert.deepStrictEqual(res, [{ ok: true, method: "inserted" }], "composeur vide → inséré");
  assert.strictEqual(env.composer.text, P.off1.body, "le corps seul, sans ligne vide devant");
  assert.strictEqual(env.captured.focused, 1, "la main revient au composeur");
  assert.deepStrictEqual(env.used(), [{ type: "library-used", id: P.off1.id, action: "insert" }], "usage compté comme insertion");
  assert.deepStrictEqual(env.captured.submitted, [], "RIEN n'est envoyé");
}

{
  const env = makeContentEnv({ composerText: "hello  " });
  env.message({ type: "picker-insert", id: P.off1.id, title: P.off1.title, body: P.off1.body });
  assert.strictEqual(env.composer.text, `hello\n\n${P.off1.body}`, "brouillon gardé, une ligne vide, puis le corps");
}

{
  const env = makeContentEnv({ verify: false });
  const res = env.message({ type: "picker-insert", id: P.off1.id, title: P.off1.title, body: P.off1.body });
  assert.deepStrictEqual(res, [{ ok: false, reason: "verify_failed" }], "injection non vérifiée");
  assert.strictEqual(env.captured.focused, 0, "pas de focus sur un échec");
  assert.deepStrictEqual(env.used()[0].action, "copy", "le popup va copier : l'usage est compté comme copie");
}

{
  const env = makeContentEnv({ disclosure: false });
  const res = env.message({ type: "picker-insert", id: P.off1.id, body: P.off1.body });
  assert.deepStrictEqual(res, [{ ok: false, reason: "inert" }], "veille : l'onglet n'insère rien");
  assert.strictEqual(env.composer.text, "", "le composeur n'est pas touché");
  assert.deepStrictEqual(env.used(), [], "aucun usage compté");
}

{
  const env = makeContentEnv({ modalOpen: true });
  const res = env.message({ type: "picker-insert", id: P.off1.id, body: P.off1.body });
  assert.deepStrictEqual(res, [{ ok: false, reason: "inert" }], "dialogue socratique en cours : inerte");
}

{
  const env = makeContentEnv({ healthy: false });
  const res = env.message({ type: "picker-insert", id: P.off1.id, body: P.off1.body });
  assert.deepStrictEqual(res, [{ ok: false, reason: "no_composer" }], "UI du site méconnue");
}

{
  const env = makeContentEnv();
  const res = env.message({ type: "picker-insert", id: P.off1.id, body: "   " });
  assert.deepStrictEqual(res, [{ ok: false, reason: "verify_failed" }], "corps vide : rien à insérer");
  assert.deepStrictEqual(env.used(), [], "et rien n'est compté");
}

{
  // Le popup insère pendant que la palette est ouverte : elle se ferme d'abord.
  const env = makeContentEnv();
  env.picker.open = true;
  env.message({ type: "picker-insert", id: P.off1.id, body: P.off1.body });
  assert.deepStrictEqual(env.captured.closed, ["insert"], "le sélecteur cède la place");
}

{
  // Un message inconnu ne reçoit aucune réponse (capture.test.js le vérifie
  // pour coach-ping ; on le garde vrai avec deux types de plus).
  const env = makeContentEnv();
  assert.deepStrictEqual(env.message({ type: "autre-chose" }), []);
}
console.log("  ✓ content.js : picker-insert → formes {ok}, fusion, usage compté, jamais d'envoi");

/* ---------- picker-open : la même porte pour le raccourci ---------- */

{
  const env = makeContentEnv({ disclosure: false });
  assert.deepStrictEqual(env.message({ type: "picker-open" }), [{ ok: false }], "veille : rien ne s'ouvre");
  assert.strictEqual(env.captured.opened.length, 0);
}
{
  const env = makeContentEnv({ modalOpen: true });
  assert.deepStrictEqual(env.message({ type: "picker-open" }), [{ ok: false }], "modale en cours : refus");
}
{
  const env = makeContentEnv({ healthy: false });
  assert.deepStrictEqual(env.message({ type: "picker-open" }), [{ ok: false }], "sans composeur : refus");
}
{
  const env = makeContentEnv({ composerText: "brouillon" });
  assert.deepStrictEqual(env.message({ type: "picker-open" }), [{ ok: true }], "ouvert");
  const opts = env.captured.opened[0];
  assert.strictEqual(opts.source, "shortcut");
  assert.strictEqual(opts.appUrl, "https://app.example", "lien « Gérer » dérivé de CoachConfig");
  assert.deepStrictEqual(opts.prompts, ALL, "la liste en mémoire (chargée au démarrage) est passée");
  assert.strictEqual(typeof opts.onInsert, "function");
  assert.strictEqual(typeof opts.onClose, "function");
  // Le rappel d'insertion du sélecteur suit la même règle de fusion.
  assert.strictEqual(opts.onInsert(P.peer1), true);
  assert.strictEqual(env.composer.text, `brouillon\n\n${P.peer1.body}`);
  assert.deepStrictEqual(env.used().map((m) => m.action), ["insert"]);
  // Fermeture : la main revient au composeur.
  opts.onClose("escape");
  assert.ok(env.captured.focused >= 2);
  // Déjà ouvert : ok, sans seconde palette.
  assert.deepStrictEqual(env.message({ type: "picker-open" }), [{ ok: true }]);
  assert.strictEqual(env.captured.opened.length, 1, "une seule ouverture");
  assert.deepStrictEqual(env.captured.submitted, [], "RIEN n'est envoyé");
}
console.log("  ✓ content.js : picker-open → même porte que « // », rappels câblés");

/* ---------- Le déclencheur « // » ---------- */

{
  const env = makeContentEnv();
  const fire = (text, ev = {}) => {
    env.composer.text = text;
    env.captured.inputListener({ fromComposer: true, inputType: "insertText", isComposing: false, ...ev });
  };
  assert.strictEqual(typeof env.captured.inputListener, "function", "écouteur input en phase capture");

  fire("//");
  assert.strictEqual(env.captured.opened.length, 1, "« // » ouvre");
  assert.strictEqual(env.captured.opened[0].source, "slash");
  assert.strictEqual(env.captured.cleared, 1, "les deux caractères sont effacés avant l'ouverture");
  assert.strictEqual(env.composer.text, "", "composeur vide");

  // Palette ouverte : la frappe dans sa recherche remonte aussi au document.
  fire("//");
  assert.strictEqual(env.captured.opened.length, 1, "déjà ouvert : rien de plus");
  env.picker.open = false;

  // Double `input` dans la demi-seconde : une seule ouverture.
  fire("//");
  assert.strictEqual(env.captured.opened.length, 1, "garde de 500 ms");
}
{
  const env = makeContentEnv();
  const fire = (text, ev = {}) => {
    env.composer.text = text;
    env.captured.inputListener({ fromComposer: true, inputType: "insertText", isComposing: false, ...ev });
  };
  fire("//", { inputType: "insertFromPaste" });
  fire("//", { isComposing: true });
  fire("//", { inputType: "historyUndo" });
  fire("//x");
  fire("x //");
  fire("https://");
  fire("/");
  fire("//", { fromComposer: false });
  assert.strictEqual(env.captured.opened.length, 0, "collage, IME, annulation, hors composeur, autre texte : jamais");
  assert.strictEqual(env.captured.cleared, 0, "et rien n'est effacé");
}
{
  const env = makeContentEnv({ modalOpen: true });
  env.composer.text = "//";
  env.captured.inputListener({ fromComposer: true, inputType: "insertText" });
  assert.strictEqual(env.captured.opened.length, 0, "modale socratique ouverte : « // » se tait");
  assert.strictEqual(env.composer.text, "//", "et ne touche pas au composeur");
}
{
  const env = makeContentEnv({ disclosure: false });
  env.composer.text = "//";
  env.captured.inputListener({ fromComposer: true, inputType: "insertText" });
  assert.strictEqual(env.captured.opened.length, 0, "veille : « // » se tait");
}
console.log("  ✓ content.js : « // » ouvre une fois, efface, se tait sur collage / IME / modale / veille");

/* ---------- Une interception ferme la palette ---------- */

{
  const env = makeContentEnv({ composerText: "fais mes devoirs" });
  env.picker.open = true;
  env.adapter.handlers.onIntercept("fais mes devoirs");
  assert.deepStrictEqual(env.captured.closed, ["intercept"], "le sélecteur cède la place au dialogue");
  assert.ok(env.captured.modal, "la modale s'ouvre");
}

/* ---------- La pastille reçoit de quoi ouvrir ---------- */

{
  const env = makeContentEnv();
  const badge = env.captured.badge;
  assert.strictEqual(badge.hasLibrary, true, "liste chargée → bouton « Prompts »");
  assert.strictEqual(badge.pickerChord, "⌘⇧.", "corde suggérée selon la plateforme");
  badge.onOpenPicker();
  assert.strictEqual(env.captured.opened[0].source, "badge");
}
console.log("  ✓ content.js : interception ferme la palette, pastille câblée");

/* =====================================================================
   4. background.js : library-used, library-fetch, relais du raccourci
   ===================================================================== */

// background.js s'accroche à chrome.* dès le chargement (library.test.js) ;
// ici on capture en plus les rappels de message et de commande, et on
// remplace CoachApi par une doublure qui compte ses appels. CoachLibrary est
// le vrai (importScripts est absent : on le passe en global du sandbox).
function makeWorkerEnv({ session = { user_id: "u1" }, favourites = ["fav-1"], favouritesFail = false, rpcFail = false } = {}) {
  const store = { session, orgConfig: { libraryUrl: "https://app.example/api/prompt-library" } };
  const captured = { messageListeners: [], commandListeners: [], tabMessages: [], rpc: [], favouriteCalls: 0 };
  const chrome = {
    runtime: {
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      onMessage: { addListener(fn) { captured.messageListeners.push(fn); } },
      onUpdateAvailable: { addListener() {} },
      getURL: (p) => p,
      lastError: null,
    },
    storage: {
      local: {
        get(keys, cb) {
          const out = {};
          for (const k of Array.isArray(keys) ? keys : [keys]) if (k in store) out[k] = store[k];
          cb(out);
        },
        set(obj, cb) { Object.assign(store, obj); cb && cb(); },
        remove(keys, cb) { for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k]; cb && cb(); },
      },
      onChanged: { addListener() {} },
    },
    alarms: { create() {}, onAlarm: { addListener() {} } },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    commands: { onCommand: { addListener(fn) { captured.commandListeners.push(fn); } } },
    tabs: {
      create() {},
      query(_f, cb) { cb([{ id: 42 }]); },
      sendMessage(tabId, msg, cb) { captured.tabMessages.push({ tabId, msg }); cb && cb(); },
    },
    permissions: { contains: (_p, cb) => cb(false) },
  };
  const api = {
    SUPABASE_URL: "https://x.supabase.co",
    APP_URL: "https://app.example",
    ensureDeviceId: async () => {},
    refreshOrgConfig: async () => ({}),
    syncEvents: async () => ({}),
    syncPostEvents: async () => ({}),
    heartbeat: async () => {},
    llmNextQuestion: async () => null,
    async fetchFavourites() {
      captured.favouriteCalls++;
      if (favouritesFail) throw new Error("rest_404: relation does not exist");
      return favourites;
    },
    async countPromptCopy(id) {
      captured.rpc.push(id);
      if (rpcFail) throw new Error("rest_401: nope");
    },
  };
  const sandbox = {
    chrome, CoachApi: api, CoachLibrary: L, console,
    setTimeout, clearTimeout, Date, Math, JSON, Object, Promise, Error, Boolean, Number, Array, String, Set, Map, URL,
    AbortController, fetch: async () => { throw new Error("réseau coupé"); },
    self: {},
  };
  const keys = Object.keys(sandbox);
  new Function(...keys, read("src/background.js"))(...keys.map((k) => sandbox[k]));
  const message = (msg) =>
    new Promise((resolve) => {
      for (const fn of captured.messageListeners) {
        const async = fn(msg, {}, resolve);
        if (async === false) return; // réponse déjà donnée de façon synchrone
      }
    });
  return { store, captured, message };
}

(async () => {
  /* ---------- library-used : récents plafonnés, RPC pour les seuls uuid ---------- */
  {
    const env = makeWorkerEnv();
    const ids = Array.from({ length: 12 }, (_, i) => `6f0b7c3e-0000-4a2b-9c3d-${String(i).padStart(12, "0")}`);
    const responses = [];
    for (const id of ids) responses.push(await env.message({ type: "library-used", id, action: "insert" }));
    assert.ok(responses.every((r) => r && r.ok === true), "répond ok tout de suite");
    await new Promise((r) => setImmediate(r));
    assert.strictEqual(env.store.libraryRecent.length, L.RECENT_MAX, "douze usages, dix récents");
    assert.strictEqual(env.store.libraryRecent[0], ids[11], "le dernier utilisé en tête");
    assert.deepStrictEqual(env.captured.rpc, ids, "la RPC est appelée pour chaque uuid");

    // Le même id deux fois : une seule entrée, remontée en tête.
    await env.message({ type: "library-used", id: ids[3], action: "copy" });
    await new Promise((r) => setImmediate(r));
    assert.strictEqual(env.store.libraryRecent[0], ids[3]);
    assert.strictEqual(env.store.libraryRecent.filter((x) => x === ids[3]).length, 1, "pas de doublon");
  }
  {
    const env = makeWorkerEnv();
    await env.message({ type: "library-used", id: "school-intro", action: "insert" });
    await env.message({ type: "library-used", id: "p0", action: "copy" });
    await new Promise((r) => setImmediate(r));
    assert.deepStrictEqual(env.store.libraryRecent, ["p0", "school-intro"], "les slugs entrent dans les récents");
    assert.deepStrictEqual(env.captured.rpc, [], "mais n'appellent jamais la RPC");
  }
  {
    // RPC en échec (hors ligne, non appairé, migration pas encore passée) :
    // avalé, et la chaîne continue d'enregistrer les récents suivants.
    const env = makeWorkerEnv({ rpcFail: true });
    await env.message({ type: "library-used", id: "6f0b7c3e-0000-4a2b-9c3d-000000000001" });
    await env.message({ type: "library-used", id: "6f0b7c3e-0000-4a2b-9c3d-000000000002" });
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.strictEqual(env.store.libraryRecent.length, 2, "l'échec de la RPC ne bloque pas les récents");
  }
  {
    const env = makeWorkerEnv();
    const res = await env.message({ type: "library-used" });
    assert.deepStrictEqual(res, { ok: true }, "sans id : ok, sans effet");
    await new Promise((r) => setImmediate(r));
    assert.strictEqual(env.store.libraryRecent, undefined);
  }
  console.log("  ✓ background : library-used → récents plafonnés, RPC pour les uuid seulement, erreurs avalées");

  /* ---------- library-fetch : { prompts, starred } ---------- */
  {
    const env = makeWorkerEnv({ favourites: ["fav-1", "fav-2"] });
    const res = await env.message({ type: "library-fetch" });
    assert.ok("prompts" in res && "starred" in res, "les deux clés sont toujours là");
    assert.deepStrictEqual(res.starred, ["fav-1", "fav-2"], "favoris du compte appairé");
    assert.deepStrictEqual(env.store.libraryStarred.ids, ["fav-1", "fav-2"], "mis en cache");
    // Second appel dans le TTL : servi du cache, pas de second appel REST.
    await env.message({ type: "library-fetch" });
    assert.strictEqual(env.captured.favouriteCalls, 1, "TTL de 15 min respecté");
    await env.message({ type: "library-fetch", force: true });
    assert.strictEqual(env.captured.favouriteCalls, 2, "force relit");
  }
  {
    // null et non undefined : undefined réveillerait la valeur par défaut du
    // paramètre, et l'env aurait une session.
    const env = makeWorkerEnv({ session: null });
    env.store.libraryStarred = { fetchedAt: Date.now(), ids: ["vieux"] };
    const res = await env.message({ type: "library-fetch" });
    assert.strictEqual(res.starred, null, "non appairé : null");
    assert.strictEqual(env.store.libraryStarred, undefined, "et le cache d'un ancien compte est retiré");
    assert.strictEqual(env.captured.favouriteCalls, 0, "aucun appel réseau sans session");
  }
  {
    // Table absente (avant la migration) ou réseau coupé : cache s'il existe, sinon null.
    const env = makeWorkerEnv({ favouritesFail: true });
    assert.strictEqual((await env.message({ type: "library-fetch" })).starred, null, "404 → null, sans lever");
    env.store.libraryStarred = { fetchedAt: 0, ids: ["cache"] };
    assert.deepStrictEqual((await env.message({ type: "library-fetch" })).starred, ["cache"], "cache périmé servi sur erreur");
  }
  console.log("  ✓ background : library-fetch → { prompts, starred }, TTL, null sans session, cache sur erreur");

  /* ---------- Raccourci clavier : relayé à l'onglet, jamais ouvert ici ---------- */
  {
    const env = makeWorkerEnv();
    assert.strictEqual(env.captured.commandListeners.length, 1, "le worker écoute les commandes");
    const fire = env.captured.commandListeners[0];
    fire("open-prompt-picker", { id: 7 });
    assert.deepStrictEqual(env.captured.tabMessages, [{ tabId: 7, msg: { type: "picker-open" } }], "relayé à l'onglet de la commande");
    fire("open-prompt-picker", undefined);
    assert.deepStrictEqual(env.captured.tabMessages[1], { tabId: 42, msg: { type: "picker-open" } }, "sans onglet : l'onglet actif");
    fire("autre-commande", { id: 7 });
    assert.strictEqual(env.captured.tabMessages.length, 2, "une commande inconnue ne relaie rien");
  }
  console.log("  ✓ background : la commande du manifest relaie picker-open à l'onglet");

  console.log("picker.test.js : CoachLibrary, content.js, background.js ✓");
})().catch((e) => {
  console.error("picker.test.js ✗", e);
  process.exit(1);
});
