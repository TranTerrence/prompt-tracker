// Tests de CoachStaleTabs (src/stale-tabs.js) : node extension/tests/stale-tabs.test.js
// Zéro dépendance : assert natif, chargement par eval indirect, comme les
// autres tests du dépôt.
//
// L'INVARIANT CENTRAL : `list` ne signale un onglet que si son content script
// n'a PAS répondu. Un doute — API absente, permission non accordée, erreur
// inattendue — se résout en silence, jamais en bandeau affiché à tort. Montrer
// « recharge tes onglets » à quelqu'un dont les onglets marchent est le seul
// échec vraiment coûteux ici : il détruit la confiance dans le message.

const fs = require("fs");
const path = require("path");
const assert = require("assert");

globalThis.self = globalThis;
const SRC = fs.readFileSync(path.join(__dirname, "..", "src", "stale-tabs.js"), "utf8");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));

// Chrome pose runtime.lastError AVANT d'appeler le callback et l'efface après :
// tout le diagnostic de ce module en dépend, donc le stub le simule vraiment.
function load({ tabs, alive = [], queryThrows = false, noTabsApi = false, manifest = MANIFEST }) {
  const reloaded = [];
  const chrome = {
    runtime: { getManifest: () => manifest, lastError: undefined },
    tabs: noTabsApi
      ? undefined
      : {
          query(_filter, cb) {
            if (queryThrows) throw new Error("permission absente");
            cb(tabs);
          },
          sendMessage(tabId, _msg, cb) {
            if (alive.includes(tabId)) {
              cb({ ok: true });
              return;
            }
            chrome.runtime.lastError = { message: "Could not establish connection." };
            cb(undefined);
            chrome.runtime.lastError = undefined;
          },
          reload(tabId, _opts, cb) {
            reloaded.push(tabId);
            cb();
          },
        },
  };
  globalThis.chrome = chrome;
  (0, eval)(SRC);
  return { mod: globalThis.CoachStaleTabs, chrome, reloaded };
}

function listSync(mod) {
  let out = "jamais appelé";
  mod.list((stale) => (out = stale));
  assert.notStrictEqual(out, "jamais appelé", "list doit TOUJOURS rappeler son callback");
  return out;
}

/* ---------- Les sites viennent du manifest, pas d'une liste recopiée ---------- */

{
  const { mod } = load({ tabs: [] });
  const patterns = mod.matchPatterns();
  const expected = MANIFEST.content_scripts.flatMap((cs) => cs.matches);
  assert.deepStrictEqual(patterns, expected, "les patterns sont ceux du manifest");
  assert.ok(patterns.includes("https://chatgpt.com/*"), "ChatGPT couvert");
  assert.ok(patterns.includes("https://claude.ai/*"), "Claude couvert");
  assert.ok(patterns.length >= 5, "les cinq sites du manifest sont là");
}

/* ---------- Aucun onglet IA ouvert ---------- */

assert.deepStrictEqual(listSync(load({ tabs: [] }).mod), [], "aucun onglet → rien à signaler");

/* ---------- Tous les onglets répondent : le content script est en place ---------- */

assert.deepStrictEqual(
  listSync(load({ tabs: [{ id: 1 }, { id: 2 }], alive: [1, 2] }).mod),
  [],
  "tous vivants → aucun bandeau"
);

/* ---------- Panachage : exactement les muets ---------- */

assert.deepStrictEqual(
  listSync(load({ tabs: [{ id: 7 }, { id: 8 }, { id: 9 }], alive: [8] }).mod),
  [7, 9],
  "seuls les onglets sans content script sont signalés"
);

/* ---------- Environnements dégradés : [] et jamais d'exception ---------- */

// Firefox avant l'octroi des permissions d'hôte : query lève ou ne voit rien.
assert.deepStrictEqual(listSync(load({ tabs: [{ id: 1 }], queryThrows: true }).mod), [], "query qui lève → []");
// Safari / harnais HTML : pas d'API tabs du tout.
assert.deepStrictEqual(listSync(load({ tabs: [], noTabsApi: true }).mod), [], "sans chrome.tabs → []");
// Manifest sans content_scripts : on n'a rien à interroger.
assert.deepStrictEqual(listSync(load({ tabs: [{ id: 1 }], manifest: {} }).mod), [], "manifest vide → []");
// query renvoie autre chose qu'un tableau (contrat non tenu).
assert.deepStrictEqual(listSync(load({ tabs: null }).mod), [], "query non conforme → []");

/* ---------- reload : explicite, borné, et toujours rappelé ---------- */

{
  const { mod, reloaded } = load({ tabs: [{ id: 3 }, { id: 4 }] });
  let done = false;
  mod.reload([3, 4], () => (done = true));
  assert.deepStrictEqual(reloaded, [3, 4], "les deux onglets sont rechargés");
  assert.strictEqual(done, true, "le callback est appelé une fois tout rechargé");
}

{
  // Liste vide ou entrée invalide : aucun rechargement, mais le callback part
  // quand même — l'UI attend dessus pour afficher « Onglets rechargés ✓ ».
  const { mod, reloaded } = load({ tabs: [] });
  let calls = 0;
  mod.reload([], () => calls++);
  mod.reload(null, () => calls++);
  assert.deepStrictEqual(reloaded, [], "rien à recharger");
  assert.strictEqual(calls, 2, "le callback part dans tous les cas");
}

console.log("stale-tabs.test.js : tous les tests passent.");
