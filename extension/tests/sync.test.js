// Test de la synchronisation : node extension/tests/sync.test.js
//
// POURQUOI CE FICHIER. Le 26/08/2026, une installation affichait « Sync
// failed: Failed to execute 'json' on 'Response': Unexpected end of JSON
// input » avec 112 événements en attente depuis le 10/07 — la date où
// `Prefer: return=minimal` est arrivé sur les POST de sync. PostgREST répond
// alors 201 avec un corps VIDE, pas 204 : `rest()` tentait `res.json()` sur du
// vide et levait à chaque sync pourtant réussie. Les lignes partaient bien en
// base (ignore-duplicates absorbait les resoumissions), mais `synced: true`
// n'était jamais écrit : file figée, resoumission chaque minute, pour toujours.
//
// Ce fichier verrouille le contrat de `rest()` : un corps vide est un succès
// silencieux (null), un corps JSON est rendu parsé, quel que soit le statut.

const fs = require("fs");
const path = require("path");
const assert = require("assert");

function makeApi(seed = {}) {
  const store = { ...seed };
  const calls = [];
  let next = null; // { ok, status, body } — body "" = corps vide (return=minimal)

  const chrome = {
    storage: {
      local: {
        get(keys, cb) {
          const out = {};
          for (const k of Array.isArray(keys) ? keys : [keys]) if (store[k] !== undefined) out[k] = store[k];
          cb(out);
        },
        set(obj, cb) { Object.assign(store, obj); cb && cb(); },
        remove(keys, cb) {
          for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
          cb && cb();
        },
      },
    },
  };

  const fetchStub = async (url, opts) => {
    calls.push({ url: String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
    if (next instanceof Error) throw next;
    const r = next || { ok: true, status: 200, body: {} };
    return {
      ok: r.ok,
      status: r.status,
      // Fidèle au vrai Response : json() sur un corps vide LÈVE, exactement
      // comme Chrome. C'est ce qui rend le bogue reproductible ici.
      json: async () => {
        if (r.body === "") {
          throw new TypeError("Failed to execute 'json' on 'Response': Unexpected end of JSON input");
        }
        return r.body;
      },
      // body "" = corps vide ; sinon body est la VALEUR, sérialisée en JSON
      // comme le ferait PostgREST (une chaîne arrive donc entre guillemets).
      text: async () => (r.body === "" ? "" : JSON.stringify(r.body)),
    };
  };

  const sandbox = {
    chrome,
    fetch: fetchStub,
    self: {},
    Date, Math, JSON, Object, Promise, Error, TypeError, Boolean, Number, Array, Set, Map,
    setTimeout, clearTimeout, AbortController, console,
  };
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "supabase.js"), "utf8");
  const keys = Object.keys(sandbox);
  const api = new Function(...keys, `${src}\nreturn CoachApi;`)(...keys.map((k) => sandbox[k]));

  return { api, store, calls, setNext: (r) => (next = r) };
}

// Installation connectée, org jointe, socle accepté : le seul chemin où la
// sync pousse réellement des lignes.
const seedConnecte = (extra = {}) => ({
  session: {
    access_token: "at1",
    refresh_token: "rt1",
    expires_at: Date.now() + 3600e3,
    user_id: "u1",
    email: "x@y.z",
  },
  profile: { org_id: "org1", role: "member" },
  orgConfig: { orgId: "org1", dataRequests: {} },
  consents: {},
  baselineConsent: { accepted: true, source: "server", acceptedAt: "2026-07-01T00:00:00Z" },
  ...extra,
});

const post201Vide = { ok: true, status: 201, body: "" };

// ---------------------------------------------------------------------------

async function testSync201CorpsVide() {
  const env = makeApi(
    seedConnecte({
      events: [
        { id: "e1", ts: 1752130000000, site: "chatgpt", synced: false },
        { id: "e2", ts: 1752130001000, site: "chatgpt", synced: false },
      ],
    })
  );
  env.setNext(post201Vide);
  const r = await env.api.syncEvents();
  assert.strictEqual(r.pushed, 2, "le POST 201 sans corps est un succès");
  assert.ok(env.store.events.every((e) => e.synced), "les événements sont acquittés (synced: true)");
  assert.strictEqual(env.store.syncStatus.error, null, "aucune erreur au journal");
  assert.strictEqual(env.store.syncStatus.pending, 0, "plus rien en attente");
  console.log("  ✓ syncEvents : 201 + corps vide (return=minimal) acquitte la file");
}

async function testSyncPost201CorpsVide() {
  const env = makeApi(
    seedConnecte({
      postEvents: [{ id: "p1", ts: 1752130000000, site: "chatgpt", postKey: "k", synced: false }],
    })
  );
  env.setNext(post201Vide);
  const r = await env.api.syncPostEvents();
  assert.strictEqual(r.pushed, 1);
  assert.ok(env.store.postEvents.every((e) => e.synced), "les post-événements sont acquittés aussi");
  assert.strictEqual(env.store.syncStatus.error, null);
  console.log("  ✓ syncPostEvents : même contrat, même acquittement");
}

async function testSetConsents201CorpsVide() {
  // Même en-tête return=minimal, même piège latent.
  const env = makeApi(seedConnecte());
  env.setNext(post201Vide);
  await env.api.setConsents({ prompt_text: true });
  assert.deepStrictEqual(env.store.consents, { prompt_text: true }, "les consentements sont enregistrés");
  console.log("  ✓ setConsents : l'upsert return=minimal ne lève plus");
}

async function testCorpsJsonToujoursParse() {
  // Contre-épreuve : un corps JSON non vide doit toujours revenir parsé.
  const env = makeApi(seedConnecte());
  env.setNext({ ok: true, status: 200, body: "2026-08-26T10:00:00Z" });
  const at = await env.api.ackBaselineConsent();
  assert.strictEqual(at, "2026-08-26T10:00:00Z", "un corps JSON est rendu parsé, pas null");
  console.log("  ✓ rest : un corps JSON non vide reste parsé");
}

(async () => {
  await testSync201CorpsVide();
  await testSyncPost201CorpsVide();
  await testSetConsents201CorpsVide();
  await testCorpsJsonToujoursParse();
  console.log("sync.test.js : un corps vide est un succès, la file s'acquitte ✓");
  process.exit(0);
})().catch((e) => {
  console.error("sync.test.js ✗", e);
  process.exit(1);
});
